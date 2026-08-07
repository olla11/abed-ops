import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

type Admin = ReturnType<typeof createAdminClient>

function missionEmailHtml(titre: string, prenoms: string | null, message: string, missionId: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">${titre}</h1>
      </div>
      <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;">Bonjour <strong>${prenoms ?? ''}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;">${message}</p>
        <a href="${APP_URL}/missions/${missionId}" style="display:inline-block;background:#63a521;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
          Voir la mission →
        </a>
      </div>
    </div>
  `
}

/** Notifie (in-app + email) une seule personne au sujet d'une mission. */
export async function notifyMissionUser(admin: Admin, opts: {
  userId: string
  missionId: string
  titre: string
  message: string
  lien?: string
}) {
  await admin.from('notifications').insert({
    user_id: opts.userId,
    titre: opts.titre,
    message: opts.message,
    lien: opts.lien ?? `/missions/${opts.missionId}`,
  })

  const { data: p } = await admin.from('profiles').select('prenoms, email').eq('id', opts.userId).single()
  if (p?.email) {
    await sendEmail({
      to: p.email,
      subject: `[My ABED] ${opts.titre}`,
      html: missionEmailHtml(opts.titre, p.prenoms, opts.message, opts.missionId),
    }).catch(console.error)
  }
}

/** Notifie (in-app + email) toutes les personnes ayant l'un des rôles donnés. */
export async function notifyMissionByRole(admin: Admin, opts: {
  roles: string[]
  missionId: string
  titre: string
  message: string
  excludeId?: string | null
}) {
  const { data: profiles } = await admin.from('profiles').select('id, prenoms, email').in('role', opts.roles)
  const list = (profiles ?? []).filter(p => p.id !== opts.excludeId)

  for (const p of list) {
    await admin.from('notifications').insert({
      user_id: p.id,
      titre: opts.titre,
      message: opts.message,
      lien: `/missions/${opts.missionId}`,
    })
    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${opts.titre}`,
        html: missionEmailHtml(opts.titre, p.prenoms, opts.message, opts.missionId),
      }).catch(console.error)
    }
  }
}
