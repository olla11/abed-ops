import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { resolveAttachments, corpsToHtml, corpsToPlainText, type PieceJointeMeta } from '@/lib/announcements'

// Cron — vérifie régulièrement les communications ciblées programmées dont
// l'heure est arrivée (announcements.status = 'pending' et scheduled_at <=
// maintenant) et les envoie réellement à ce moment-là.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: dues } = await admin
    .from('announcements')
    .select('id, sujet, corps, canaux, destinataire_ids, pieces_jointes')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())

  if (!dues || dues.length === 0) {
    return NextResponse.json({ ok: true, traitees: 0 })
  }

  for (const a of dues) {
    try {
      const sendCanaux = new Set((a.canaux as string[]) ?? [])
      const { data: targets } = await admin
        .from('profiles')
        .select('id, prenoms, nom, email')
        .in('id', (a.destinataire_ids as string[]) ?? [])
      const recipients = (targets ?? []).filter(t => !!t.email)

      const pieces = (a.pieces_jointes as PieceJointeMeta[]) ?? []
      const attachments = pieces.length > 0 ? await resolveAttachments(admin, pieces) : []

      if (sendCanaux.has('email')) {
        for (const target of recipients) {
          const corpsPersonnalise = (a.corps as string)
            .replace(/\{prenom\}/gi, target.prenoms ?? '')
            .replace(/\{nom\}/gi, target.nom ?? '')
            .replace(/\{email\}/gi, target.email ?? '')
          try {
            await sendEmail({
              to: target.email!,
              subject: a.sujet as string,
              html: `<div style="font-size:14px;line-height:1.6;color:#1f2a17;">${corpsToHtml(corpsPersonnalise)}</div>`,
              attachments: attachments.length > 0 ? attachments : undefined,
            })
          } catch (e) {
            console.error('[announcements-programmees] échec email', target.email, e)
          }
        }
      }

      if (sendCanaux.has('notification') && recipients.length > 0) {
        await admin.from('notifications').insert(
          recipients.map(target => ({
            user_id: target.id,
            titre: a.sujet as string,
            message: corpsToPlainText((a.corps as string)
              .replace(/\{prenom\}/gi, target.prenoms ?? '')
              .replace(/\{nom\}/gi, target.nom ?? '')
              .replace(/\{email\}/gi, target.email ?? '')),
          }))
        )
      }

      await admin.from('announcements').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', a.id)
    } catch (e) {
      console.error('[announcements-programmees] échec traitement', a.id, e)
      await admin.from('announcements').update({ status: 'failed' }).eq('id', a.id)
    }
  }

  return NextResponse.json({ ok: true, traitees: dues.length })
}
