import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Cron job — tous les jours à 7h. Rappels d'échéance pour les opportunités
// BD encore en préparation (jamais soumises) — mêmes seuils que
// /api/cron/echeances-activites (retard, demain, dans 3 jours).
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

  const { data: opportunites } = await supabase
    .from('opportunites_bd')
    .select(`id, titre, bailleur, date_limite, identifie_par, responsable_id, associes_ids, retard_notifie_le,
      identifieur:profiles!opportunites_bd_identifie_par_fkey(id, nom, prenoms, email),
      responsable:profiles!opportunites_bd_responsable_id_fkey(id, nom, prenoms, email)`)
    .in('statut', ['identifie', 'en_preparation'])
    .not('date_limite', 'is', null)

  if (!opportunites?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  for (const opp of opportunites) {
    const limite = new Date(opp.date_limite as string)
    limite.setHours(0, 0, 0, 0)

    // Le rappel "en retard" ne part qu'une seule fois — sans ça, une
    // opportunité qui reste en préparation après sa date limite recevrait le
    // même mail tous les jours indéfiniment.
    const isOverdue = limite < today && !opp.retard_notifie_le
    const isDueTomorrow = limite.getTime() === tomorrow.getTime()
    const isDueIn3Days = limite.getTime() === in3days.getTime()
    if (!isOverdue && !isDueTomorrow && !isDueIn3Days) continue

    const dateStr = limite.toLocaleDateString('fr-FR')
    let subject = '', urgenceColor = '#f59e0b', urgenceLabel = ''
    if (isOverdue) {
      subject = `[My ABED] ⚠️ Opportunité BD en retard : ${opp.titre}`
      urgenceColor = '#dc2626'
      urgenceLabel = `Date limite dépassée (${dateStr}) — jamais soumise`
    } else if (isDueTomorrow) {
      subject = `[My ABED] ⏰ Opportunité BD due demain : ${opp.titre}`
      urgenceColor = '#f59e0b'
      urgenceLabel = `Date limite demain (${dateStr})`
    } else {
      subject = `[My ABED] 📅 Rappel opportunité BD : ${opp.titre}`
      urgenceColor = '#2563eb'
      urgenceLabel = `Date limite dans 3 jours (${dateStr})`
    }

    // Responsable + associés + identifieur — dédupliqués (une personne peut
    // cumuler plusieurs rôles sur la même opportunité).
    const destinataires = new Map<string, { id: string; nom: string; prenoms: string; email: string | null }>()
    const identifieur = opp.identifieur as any
    const responsable = opp.responsable as any
    if (identifieur) destinataires.set(identifieur.id, identifieur)
    if (responsable) destinataires.set(responsable.id, responsable)
    if ((opp.associes_ids as string[] | null)?.length) {
      const { data: associes } = await supabase.from('profiles').select('id, nom, prenoms, email').in('id', opp.associes_ids as string[])
      for (const a of associes ?? []) destinataires.set(a.id, a as any)
    }

    for (const dest of destinataires.values()) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: dest.id,
        titre: urgenceLabel,
        message: `« ${opp.titre} »${opp.bailleur ? ` (${opp.bailleur})` : ''}`,
        lien: `/bd/opportunites/${opp.id}`,
      })
      if (notifErr) console.error(notifErr)

      if (dest.email) {
        await sendEmail({
          to: dest.email,
          subject,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:${urgenceColor}">${urgenceLabel}</h2>
              <p>Bonjour <strong>${dest.prenoms}</strong>,</p>
              <p>Une opportunité de financement dont vous êtes responsable ou associé(e) nécessite votre attention :</p>
              <div style="background:#fafafa;border-left:4px solid ${urgenceColor};padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
                <p style="margin:0 0 6px;font-weight:700;font-size:16px">${opp.titre}</p>
                <p style="margin:0;color:#6b7280;font-size:14px">${opp.bailleur ? `Bailleur : ${opp.bailleur}` : ''} &nbsp;|&nbsp; ${urgenceLabel}</p>
              </div>
              <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED (menu BD) pour mettre à jour le statut.</p>
            </div>
          `,
        }).catch(console.error)
      }
      sent++
    }

    if (isOverdue) {
      await supabase.from('opportunites_bd').update({ retard_notifie_le: new Date().toISOString() }).eq('id', opp.id)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
