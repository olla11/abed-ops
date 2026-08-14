import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { budgetTotalDepuisChapitres } from '@/lib/tdr'
import { genererTdrPdf, nomFichierTdrPdf, TDR_PDF_SELECT } from '@/lib/tdr-pdf'
import { genererReconciliationPdf, nomFichierReconciliationPdf, RECONCILIATION_PDF_SELECT } from '@/lib/tdr-reconciliation-pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

type Admin = ReturnType<typeof createAdminClient>

async function getTdrParticipants(admin: Admin, tdrId: string) {
  const [{ data: tdr }, { data: collaborateurs }, { data: signataires }] = await Promise.all([
    admin.from('tdrs').select('initiateur_id').eq('id', tdrId).single(),
    admin.from('tdr_collaborateurs').select('profile_id').eq('tdr_id', tdrId),
    admin.from('tdr_signataires').select('profile_id').eq('tdr_id', tdrId),
  ])

  const ids = new Set<string>()
  if (tdr?.initiateur_id) ids.add(tdr.initiateur_id)
  for (const c of collaborateurs ?? []) ids.add(c.profile_id)
  for (const s of signataires ?? []) if (s.profile_id) ids.add(s.profile_id)

  if (ids.size === 0) return []
  const { data: profiles } = await admin.from('profiles').select('id, nom, prenoms, email').in('id', [...ids])
  return profiles ?? []
}

/**
 * Notifie (in-app + email) toutes les personnes liées à un TDR (initiateur,
 * collaborateurs, signataires). Si actionPourId est fourni, cette personne
 * reçoit messageAction au lieu du message générique ("action requise" vs "info").
 */
export async function notifyTdr(tdrId: string, opts: {
  titre: string
  message: string
  actionPourId?: string | null
  messageAction?: string
  excludeId?: string
}) {
  const admin = createAdminClient()
  const participants = await getTdrParticipants(admin, tdrId)

  for (const p of participants) {
    if (opts.excludeId && p.id === opts.excludeId) continue
    const isAction = !!opts.actionPourId && p.id === opts.actionPourId
    const message = isAction ? (opts.messageAction ?? opts.message) : opts.message

    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: p.id,
      titre: opts.titre,
      message,
      lien: `/tdr/${tdrId}`,
    })
    if (notifErr) console.error(notifErr)

    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${opts.titre}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#16a34a;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:18px;">${opts.titre}</h1>
            </div>
            <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 12px;">Bonjour <strong>${p.prenoms}</strong>,</p>
              <p style="margin:0 0 20px;color:#374151;">${message}</p>
              <a href="${APP_URL}/tdr/${tdrId}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                Voir le TdR →
              </a>
            </div>
          </div>
        `,
      }).catch(console.error)
    }
  }
}

/**
 * Appelé une seule fois, à la signature finale du DE (TDR devenu "actif") :
 * fige le budget approuvé, et ouvre le dossier de suivi financier — email
 * (avec le TDR en PDF joint) + notification au responsable (initiateur, PAS
 * le responsable technique), à toute la CAF et tout l'AAF, puisque c'est
 * l'AAF qui va désormais suivre l'exécution financière (factures) jusqu'à
 * la réconciliation finale.
 */
export async function ouvrirSuiviFinancierTdr(tdrId: string) {
  const admin = createAdminClient()

  const { data: tdr } = await admin.from('tdrs').select(TDR_PDF_SELECT).eq('id', tdrId).single()
  if (!tdr) return

  const budgetTotal = budgetTotalDepuisChapitres(tdr.chapitres as any)
  await admin.from('tdrs').update({ budget_total_valide: budgetTotal }).eq('id', tdrId)

  const [{ data: aafCaf }, { data: responsable }] = await Promise.all([
    admin.from('profiles').select('id, nom, prenoms, email').in('role', ['aaf', 'caf']).eq('archived', false),
    admin.from('profiles').select('id, nom, prenoms, email').eq('id', tdr.initiateur_id).single(),
  ])

  const destinataires = new Map<string, { id: string; nom: string; prenoms: string; email: string | null }>()
  if (responsable) destinataires.set(responsable.id, responsable)
  for (const p of aafCaf ?? []) destinataires.set(p.id, p)
  if (destinataires.size === 0) return

  let pdfBase64: string | null = null
  let nomFichier = ''
  try {
    const pdfBuffer = await genererTdrPdf(tdr)
    pdfBase64 = pdfBuffer.toString('base64')
    nomFichier = nomFichierTdrPdf(tdr)
  } catch (e) {
    console.error('[ouvrirSuiviFinancierTdr] échec génération PDF:', e)
  }

  const titre = `TdR N° ${tdr.numero} autorisé pour exécution financière`
  const message = `Le TdR « ${tdr.titre_activite} » (${tdr.numero}) est autorisé pour exécution financière. Le dossier de suivi financier est désormais ouvert chez l'AAF (enregistrement des factures), jusqu'à la réconciliation finale.`

  for (const p of destinataires.values()) {
    await admin.from('notifications').insert({
      user_id: p.id, titre, message, lien: `/tdr/${tdrId}`,
    })
    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${titre}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#16a34a;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:18px;">${titre}</h1>
            </div>
            <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 12px;">Bonjour <strong>${p.prenoms}</strong>,</p>
              <p style="margin:0 0 20px;color:#374151;">${message}</p>
              <a href="${APP_URL}/tdr/${tdrId}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                Voir le TdR →
              </a>
            </div>
          </div>
        `,
        attachments: pdfBase64 ? [{ filename: nomFichier, content: pdfBase64 }] : undefined,
      }).catch(console.error)
    }
  }
}

/**
 * Appelée à la clôture définitive d'un TDR (signature du responsable) :
 * notifie toutes les personnes liées au TDR, avec le rapport de
 * réconciliation en PDF joint (synthèse financière, factures, signatures
 * AAF/CAF/responsable).
 */
export async function notifierClotureAvecRapport(tdrId: string, excludeId?: string) {
  const admin = createAdminClient()
  const [participants, { data: tdr }, { data: factures }] = await Promise.all([
    getTdrParticipants(admin, tdrId),
    admin.from('tdrs').select(RECONCILIATION_PDF_SELECT).eq('id', tdrId).single(),
    admin.from('tdr_factures')
      .select('description, montant, date_facture, enregistre_par:profiles!tdr_factures_enregistre_par_fkey(nom, prenoms)')
      .eq('tdr_id', tdrId).order('date_facture', { ascending: true }),
  ])
  if (!tdr) return

  let pdfBase64: string | null = null
  let nomFichier = ''
  try {
    const pdfBuffer = await genererReconciliationPdf(tdr as any, (factures ?? []) as any)
    pdfBase64 = pdfBuffer.toString('base64')
    nomFichier = nomFichierReconciliationPdf(tdr)
  } catch (e) {
    console.error('[notifierClotureAvecRapport] échec génération PDF:', e)
  }

  const titre = 'TdR clôturé'
  const message = `Le TdR « ${(tdr as any).titre_activite} » (${(tdr as any).numero}) a été clôturé. Le rapport de réconciliation est joint en PDF.`

  for (const p of participants) {
    if (excludeId && p.id === excludeId) continue
    await admin.from('notifications').insert({ user_id: p.id, titre, message, lien: `/tdr/${tdrId}` })
    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${titre}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#16a34a;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:18px;">${titre}</h1>
            </div>
            <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 12px;">Bonjour <strong>${p.prenoms}</strong>,</p>
              <p style="margin:0 0 20px;color:#374151;">${message}</p>
              <a href="${APP_URL}/tdr/${tdrId}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                Voir le TdR →
              </a>
            </div>
          </div>
        `,
        attachments: pdfBase64 ? [{ filename: nomFichier, content: pdfBase64 }] : undefined,
      }).catch(console.error)
    }
  }
}
