import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

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
                Voir le TDR →
              </a>
            </div>
          </div>
        `,
      }).catch(console.error)
    }
  }
}
