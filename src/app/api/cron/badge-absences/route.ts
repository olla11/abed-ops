import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { debutJourLocal, dateLocaleISO } from '@/lib/badge-jours'

// Cron job — jours ouvrés à 18h (heure du Bénin — voir vercel.json :
// "0 17 * * 1-5"). Pour chaque employé actif, pas en congé approuvé
// aujourd'hui, sans aucune entrée réussie aujourd'hui : enregistre une
// ligne statut='non_badge'. Sans ça, une journée oubliée ne laisse aucune
// trace et ne peut pas être distinguée d'un jour sans donnée — voir
// /badge/historique et badge-rappel-absences-repetees, qui en dépendent.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = dateLocaleISO()
  const debutJour = debutJourLocal()

  const { data: profils } = await admin.from('profiles').select('id').eq('archived', false)
  if (!profils?.length) return NextResponse.json({ ok: true, marked: 0 })

  const { data: congesAujourdhui } = await admin
    .from('conges').select('profile_id')
    .eq('statut', 'approuve').lte('date_debut', today).gte('date_fin', today)
  const enConge = new Set((congesAujourdhui ?? []).map(c => c.profile_id))

  const { data: entreesReussies } = await admin
    .from('badge_pointages').select('profile_id')
    .eq('type', 'entree').eq('statut', 'reussi')
    .gte('horodatage', debutJour.toISOString())
  const ontBadge = new Set((entreesReussies ?? []).map(p => p.profile_id))

  // Si le cron est relancé manuellement le même jour, ne pas doubler le marqueur.
  const { data: dejaMarques } = await admin
    .from('badge_pointages').select('profile_id')
    .eq('type', 'entree').eq('statut', 'non_badge')
    .gte('horodatage', debutJour.toISOString())
  const dejaNonBadge = new Set((dejaMarques ?? []).map(p => p.profile_id))

  const aMarquer = profils
    .map(p => p.id)
    .filter(id => !enConge.has(id) && !ontBadge.has(id) && !dejaNonBadge.has(id))

  if (!aMarquer.length) return NextResponse.json({ ok: true, marked: 0 })

  const lignes = aMarquer.map(id => ({
    profile_id: id, type: 'entree' as const, statut: 'non_badge' as const,
    latitude: 0, longitude: 0, distance_bureau_m: 0,
    device_id: '00000000-0000-0000-0000-000000000000',
    verification_faciale_effectuee: false,
    horodatage: debutJour.toISOString(),
  }))
  const { error } = await admin.from('badge_pointages').insert(lignes)
  if (error) { console.error(error); return NextResponse.json({ error: error.message }, { status: 500 }) }

  return NextResponse.json({ ok: true, marked: aMarquer.length })
}
