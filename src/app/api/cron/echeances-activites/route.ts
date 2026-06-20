import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Cron job — tous les jours à 7h. Alertes échéance pour les tâches de projets.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const in3days = new Date(today)
  in3days.setDate(today.getDate() + 3)

  // Tâches non terminées avec échéance
  const { data: activites } = await supabase
    .from('activites')
    .select(`id, nom, date_echeance, statut, priorite,
      assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms, email),
      projet:projets_internes!activites_projet_id_fkey(nom)`)
    .not('assignee_id', 'is', null)
    .not('date_echeance', 'is', null)
    .neq('statut', 'termine')

  if (!activites?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  for (const act of activites) {
    const assignee = act.assignee as any
    if (!assignee?.email) continue

    const echeance = new Date(act.date_echeance)
    echeance.setHours(0, 0, 0, 0)

    const isOverdue = echeance < today
    const isDueTomorrow = echeance.getTime() === tomorrow.getTime()
    const isDueIn3Days = echeance.getTime() === in3days.getTime()

    if (!isOverdue && !isDueTomorrow && !isDueIn3Days) continue

    const dateStr = echeance.toLocaleDateString('fr-FR')
    let subject = '', urgenceColor = '#f59e0b', urgenceLabel = ''

    if (isOverdue) {
      subject = `[My ABED] ⚠️ Tâche en retard : ${act.nom}`
      urgenceColor = '#dc2626'
      urgenceLabel = `Échéance dépassée (${dateStr})`
    } else if (isDueTomorrow) {
      subject = `[My ABED] ⏰ Tâche due demain : ${act.nom}`
      urgenceColor = '#f59e0b'
      urgenceLabel = `Échéance demain (${dateStr})`
    } else {
      subject = `[My ABED] 📅 Rappel tâche : ${act.nom}`
      urgenceColor = '#2563eb'
      urgenceLabel = `Échéance dans 3 jours (${dateStr})`
    }

    await sendEmail({
      to: assignee.email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:${urgenceColor}">${urgenceLabel}</h2>
          <p>Bonjour <strong>${assignee.prenoms}</strong>,</p>
          <p>Vous avez une tâche qui nécessite votre attention :</p>
          <div style="background:#fafafa;border-left:4px solid ${urgenceColor};padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px">${act.nom}</p>
            <p style="margin:0;color:#6b7280;font-size:14px">Projet : ${(act.projet as any)?.nom ?? ''} &nbsp;|&nbsp; ${urgenceLabel}</p>
          </div>
          <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour mettre à jour le statut de cette tâche.</p>
        </div>
      `,
    }).catch(console.error)
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
