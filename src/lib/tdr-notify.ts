import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

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
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#16a34a">${opts.titre}</h2>
            <p>Bonjour <strong>${p.prenoms}</strong>,</p>
            <p>${message}</p>
            <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour voir le détail du TDR.</p>
          </div>
        `,
      }).catch(console.error)
    }
  }
}
