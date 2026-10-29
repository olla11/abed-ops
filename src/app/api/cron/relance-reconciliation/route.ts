import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Cron job — tous les jours à 7h. Relances par email pour les missions
// terminées dont la réconciliation (rapport + point financier) n'est pas
// encore faite, à J+7/J+14/J+21/J+30 après la date de retour — avec mise
// en copie du manager à partir de J+21, et du DE à partir de J+30.
// Chaque palier n'est envoyé qu'une seule fois par mission, grâce à la
// contrainte unique sur alertes_envoyees(user_id, type_alerte, reference).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

const PALIERS = [
  { n: 1, jours: 7, escalade: null as 'manager' | 'de' | null },
  { n: 2, jours: 14, escalade: null },
  { n: 3, jours: 21, escalade: 'manager' as const },
  { n: 4, jours: 30, escalade: 'de' as const },
]

function emailHtml(opts: { prenoms: string | null; reference: string | null; objet: string; jours: number; missionId: string; urgent: boolean }) {
  const couleur = opts.urgent ? '#dc2626' : '#63a521'
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:${couleur};color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:18px;">Réconciliation de mission en attente</h1>
      </div>
      <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;">Bonjour <strong>${opts.prenoms ?? ''}</strong>,</p>
        <p style="margin:0 0 16px;color:#374151;">
          La mission <strong>${opts.reference ?? ''}</strong> (${opts.objet}) est terminée depuis ${opts.jours} jours et sa
          réconciliation (rapport + point financier) n'a toujours pas été soumise.
        </p>
        <a href="${APP_URL}/missions/${opts.missionId}" style="display:inline-block;background:${couleur};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
          Faire la réconciliation →
        </a>
      </div>
    </div>
  `
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const { data: missions } = await admin
    .from('missions')
    .select(`id, reference, objet, date_retour, missionnaire_id,
      missionnaire:profiles!missions_missionnaire_id_fkey(prenoms, email, manager_id)`)
    .in('status', ['en_mission', 'reconciliation'])
    .or('rapport.is.null,point_financier.is.null')

  if (!missions?.length) return NextResponse.json({ ok: true, sent: 0 })

  let deEmails: string[] | null = null
  async function getDeEmails(): Promise<string[]> {
    if (deEmails) return deEmails
    const { data } = await admin.from('profiles').select('email').eq('role', 'de').not('email', 'is', null)
    deEmails = (data ?? []).map(d => d.email as string)
    return deEmails
  }

  let sent = 0
  for (const m of missions) {
    const missionnaire = m.missionnaire as any
    if (!missionnaire?.email) continue

    const retour = new Date(m.date_retour); retour.setHours(0, 0, 0, 0)
    const jours = Math.floor((today.getTime() - retour.getTime()) / 86400000)
    if (jours < PALIERS[0].jours) continue

    for (const palier of PALIERS) {
      if (jours < palier.jours) continue

      const typeAlerte = `reconciliation_relance_${palier.n}`
      const { error: dedupErr } = await admin
        .from('alertes_envoyees')
        .insert({ user_id: m.missionnaire_id, type_alerte: typeAlerte, reference: m.id })
      if (dedupErr) continue // déjà envoyée (contrainte unique) ou autre erreur — on continue au palier suivant

      const to = [missionnaire.email]
      if (palier.escalade === 'manager' && missionnaire.manager_id) {
        const { data: manager } = await admin.from('profiles').select('email').eq('id', missionnaire.manager_id).single()
        if (manager?.email) to.push(manager.email)
      } else if (palier.escalade === 'de') {
        to.push(...(await getDeEmails()))
      }

      const titreNotif = palier.n <= 2
        ? `Rappel : réconciliation de mission requise`
        : `⚠️ Réconciliation de mission en retard (${jours} jours)`

      await admin.from('notifications').insert({
        user_id: m.missionnaire_id,
        titre: titreNotif,
        message: `Mission ${m.reference ?? ''} — réconciliation toujours en attente.`,
        lien: `/missions/${m.id}`,
      })

      await sendEmail({
        to,
        subject: `[My ABED] ${palier.n >= 3 ? '⚠️ ' : ''}Réconciliation de mission requise — ${m.reference ?? ''}`,
        html: emailHtml({ prenoms: missionnaire.prenoms, reference: m.reference, objet: m.objet, jours, missionId: m.id, urgent: palier.n >= 3 }),
      }).catch(console.error)

      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
