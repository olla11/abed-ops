import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { signExternalSignerToken } from '@/lib/external-signer-token'
import { renderHtmlToPdf } from '@/lib/office-to-pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Entry = { type: 'interne' | 'externe'; value: string }

/**
 * Bascule un document collaboratif (statut 'revision') vers le circuit de
 * signature existant : rend le contenu en PDF, l'attache à la demande, puis
 * réutilise exactement la table `signataires` et le statut 'en_attente' déjà
 * consommés par /signatures/[id]/signer — aucune modification de ce circuit
 * n'est nécessaire, il ne sait pas distinguer une demande venue d'ici.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: document, error: docErr } = await admin
    .from('demandes_signature')
    .select('id, titre, description, statut, contenu_html, createur_id')
    .eq('id', id).eq('type', 'document_collaboratif').single()

  if (docErr || !document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (document.createur_id !== user.id) {
    return NextResponse.json({ error: 'Seul le créateur du document peut le verrouiller pour signature' }, { status: 403 })
  }
  if (document.statut !== 'revision') {
    return NextResponse.json({ error: 'Ce document est déjà en signature ou terminé' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const sequentiel = body?.sequentiel !== false // séquentiel par défaut

  let entries: Entry[] = []
  try {
    const parsed = body?.signataires
    if (!Array.isArray(parsed)) throw new Error()
    entries = parsed.filter((e: unknown): e is Entry =>
      !!e && typeof e === 'object' && ((e as Entry).type === 'interne' || (e as Entry).type === 'externe') && typeof (e as Entry).value === 'string'
    )
  } catch {
    return NextResponse.json({ error: 'Liste de signataires invalide' }, { status: 400 })
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: 'Au moins un signataire est requis' }, { status: 400 })
  }

  const internes = entries.filter(e => e.type === 'interne').map(e => e.value)
  const externes = entries.filter(e => e.type === 'externe').map(e => e.value)
  for (const email of externes) {
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: `Email invalide : ${email}` }, { status: 400 })
  }
  if (externes.length > 0) {
    const { data: comptesExistants } = await admin.from('profiles').select('nom, prenoms, email').in('email', externes)
    if (comptesExistants && comptesExistants.length > 0) {
      const details = comptesExistants.map(p => `${p.email} (${p.prenoms} ${p.nom})`).join(', ')
      return NextResponse.json({ error: `Ces emails correspondent déjà à un compte existant : ${details}. Sélectionnez directement leur nom.` }, { status: 400 })
    }
  }

  // Rendu du contenu en PDF, une seule fois, avant de basculer le statut.
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderHtmlToPdf(document.contenu_html || '<p></p>', document.titre)
  } catch (err) {
    console.error('[Documents] Erreur de rendu PDF au verrouillage :', err)
    return NextResponse.json({ error: 'Impossible de générer le PDF du document.' }, { status: 500 })
  }

  await admin.storage.createBucket('documents', { public: false }).catch(() => {})
  const uploadName = `${document.titre.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'}.pdf`
  const path = `${user.id}/${Date.now()}_${uploadName}`
  const { error: uploadErr } = await admin.storage.from('documents').upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) {
    console.error('[Documents] Erreur upload PDF verrouillage :', uploadErr)
    return NextResponse.json({ error: `Erreur upload : ${uploadErr.message}` }, { status: 500 })
  }

  const { error: updErr } = await admin.from('demandes_signature')
    .update({ fichier_url: path, statut: 'en_attente', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) {
    console.error('[Documents] Erreur bascule statut verrouillage :', updErr)
    return NextResponse.json({ error: 'Erreur lors du verrouillage' }, { status: 500 })
  }

  const sigRows = entries.map((e, idx) => e.type === 'interne'
    ? { demande_id: id, profile_id: e.value, ordre: sequentiel ? idx : 0, est_observateur: false }
    : { demande_id: id, profile_id: null, email: e.value, ordre: sequentiel ? idx : 0, est_observateur: false })

  const { data: insertedSigs, error: sigErr } = await admin.from('signataires').insert(sigRows).select('id, profile_id, email, ordre')
  if (sigErr) {
    console.error('[Documents] Erreur assignation signataires :', sigErr)
    await admin.from('demandes_signature').update({ statut: 'revision', fichier_url: null }).eq('id', id)
    return NextResponse.json({ error: "Erreur lors de l'assignation des signataires" }, { status: 500 })
  }

  const { data: createur } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const createurNom = createur ? `${createur.prenoms} ${createur.nom}` : 'Un utilisateur'

  const premierPalier = Math.min(...(insertedSigs ?? []).map(s => s.ordre as number))
  const rowsPremierPalier = (insertedSigs ?? []).filter(s => s.ordre === premierPalier)
  if (rowsPremierPalier.length > 0) {
    await admin.from('signataires').update({ notifie: true }).in('id', rowsPremierPalier.map(s => s.id))
  }
  const internesAPrevenir = rowsPremierPalier.filter(s => s.profile_id)
  const externesAPrevenir = rowsPremierPalier.filter(s => !s.profile_id && s.email)

  after(async () => {
    const tasks: PromiseLike<unknown>[] = []

    if (internesAPrevenir.length > 0) {
      const { data: profils } = await admin.from('profiles').select('id, nom, prenoms, email').in('id', internesAPrevenir.map(s => s.profile_id as string))
      for (const p of profils ?? []) {
        tasks.push(admin.from('notifications').insert({
          user_id: p.id, titre: 'Document à signer',
          message: `${createurNom} vous a assigné comme signataire pour « ${document.titre} »`,
          lien: `/signatures/${id}/signer`,
        }).then(({ error: e }) => { if (e) console.error('[Documents] Notif insert error:', e) }))
        if (p.email) {
          tasks.push(sendEmail({
            to: p.email,
            subject: `My ABED — Document à signer : ${document.titre}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
                <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
                <p>Bonjour <strong>${p.prenoms} ${p.nom}</strong>,</p>
                <p><strong>${createurNom}</strong> vous a assigné comme signataire pour le document suivant :</p>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:0;font-size:16px;font-weight:700;">${document.titre}</p>
                  ${document.description ? `<p style="margin:8px 0 0;color:#6b7280;">${document.description}</p>` : ''}
                </div>
                <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">Voir le document</a>
                <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
              </div>
            `,
          }).catch(err => console.error(`[Documents] Email error for ${p.email}:`, err)))
        }
      }
    }

    for (const s of externesAPrevenir) {
      const email = s.email as string
      const token = signExternalSignerToken(s.id, email)
      const lienSignature = `${APP_URL}/signatures/externe?t=${token}`
      tasks.push(sendEmail({
        to: email,
        subject: `My ABED — Document à signer : ${document.titre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
            <p>Bonjour,</p>
            <p><strong>${createurNom}</strong> (ABED ONG) vous invite à signer le document suivant :</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0;font-size:16px;font-weight:700;">${document.titre}</p>
            </div>
            <p>Aucun compte n'est nécessaire. Cliquez sur le bouton ci-dessous, indiquez votre nom et prénom, puis signez le document :</p>
            <a href="${lienSignature}" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">Signer le document</a>
            <p style="margin-top:16px;color:#9ca3af;font-size:12px;">Ce lien est personnel et valable 30 jours. Ne le partagez pas.</p>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
          </div>
        `,
      }).catch(err => console.error(`[Documents] Email externe error for ${email}:`, err)))
    }

    await Promise.allSettled(tasks)
  })

  return NextResponse.json({ ok: true, statut: 'en_attente' })
}
