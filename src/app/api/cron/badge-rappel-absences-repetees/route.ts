import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { joursOuvresRecents, dateLocaleISO } from '@/lib/badge-jours'

const SEUIL_JOURS = 3

// Cron job — jours ouvrés à 18h15 (heure du Bénin — voir vercel.json :
// "15 17 * * 1-5"), juste après badge-absences. Si les 3 derniers jours
// ouvrés sont TOUS sans aucune entrée réussie (et sans congé approuvé ce
// jour-là), alerte l'employé et son manager direct.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const jours = joursOuvresRecents(SEUIL_JOURS) // plus récent en premier
  const premierJour = jours[jours.length - 1]
  const dernierJour = jours[0]
  const debutFenetre = new Date(`${premierJour}T00:00:00.000Z`)

  const { data: profils } = await admin
    .from('profiles').select('id, nom, prenoms, email, manager_id').eq('archived', false)
  if (!profils?.length) return NextResponse.json({ ok: true, sent: 0 })

  const { data: entreesReussies } = await admin
    .from('badge_pointages').select('profile_id, horodatage')
    .eq('type', 'entree').eq('statut', 'reussi')
    .gte('horodatage', debutFenetre.toISOString())

  const joursBadgesParProfil = new Map<string, Set<string>>()
  for (const p of entreesReussies ?? []) {
    const jourLocal = dateLocaleISO(new Date(p.horodatage))
    if (!joursBadgesParProfil.has(p.profile_id)) joursBadgesParProfil.set(p.profile_id, new Set())
    joursBadgesParProfil.get(p.profile_id)!.add(jourLocal)
  }

  const { data: congesRecents } = await admin
    .from('conges').select('profile_id, date_debut, date_fin')
    .eq('statut', 'approuve').lte('date_debut', dernierJour).gte('date_fin', premierJour)

  const absents = profils.filter(p => {
    const joursBadges = joursBadgesParProfil.get(p.id) ?? new Set()
    // Un congé approuvé sur l'un des 3 jours écarte la personne — un congé
    // n'est pas un oubli de badgeage.
    const enCongeUnJour = (congesRecents ?? []).some(c =>
      c.profile_id === p.id && jours.some(j => j >= c.date_debut && j <= c.date_fin)
    )
    if (enCongeUnJour) return false
    return jours.every(j => !joursBadges.has(j))
  })
  if (!absents.length) return NextResponse.json({ ok: true, sent: 0 })

  const managerIds = [...new Set(absents.map(p => p.manager_id).filter(Boolean))] as string[]
  const { data: managers } = managerIds.length
    ? await admin.from('profiles').select('id, nom, prenoms, email').in('id', managerIds)
    : { data: [] as { id: string; nom: string; prenoms: string; email: string | null }[] }
  const managerParId = new Map((managers ?? []).map(m => [m.id, m]))

  let sent = 0
  for (const p of absents) {
    const manager = p.manager_id ? managerParId.get(p.manager_id) : null

    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: p.id,
      titre: 'Badgeage — 3 jours sans pointage',
      message: `Aucun badgeage d'entrée enregistré depuis ${SEUIL_JOURS} jours ouvrés.`,
      lien: '/badge',
    })
    if (notifErr) console.error(notifErr)

    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: '[My ABED] Badgeage — 3 jours sans pointage',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <p>Bonjour <strong>${p.prenoms ?? ''}</strong>,</p>
            <p>Aucun badgeage d'entrée n'a été enregistré sur vos ${SEUIL_JOURS} derniers jours ouvrés. Si c'est une erreur ou un cas particulier (mission externe, oubli...), merci de régulariser votre situation auprès des RH.</p>
          </div>
        `,
      }).catch(console.error)
    }

    if (manager) {
      const { error: notifManagerErr } = await admin.from('notifications').insert({
        user_id: manager.id,
        titre: 'Badgeage — membre de votre équipe',
        message: `${p.prenoms ?? ''} ${p.nom ?? ''} n'a badgé aucune entrée depuis ${SEUIL_JOURS} jours ouvrés.`,
        lien: '/badge/historique',
      })
      if (notifManagerErr) console.error(notifManagerErr)

      if (manager.email) {
        await sendEmail({
          to: manager.email,
          subject: '[My ABED] Badgeage — membre de votre équipe',
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <p>Bonjour <strong>${manager.prenoms ?? ''}</strong>,</p>
              <p><strong>${p.prenoms ?? ''} ${p.nom ?? ''}</strong> n'a badgé aucune entrée depuis ${SEUIL_JOURS} jours ouvrés.</p>
              <p style="color:#6b7280;font-size:13px">Consultez l'historique de badgeage depuis My ABED pour plus de détails.</p>
            </div>
          `,
        }).catch(console.error)
      }
    }

    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
