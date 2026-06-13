import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function countWorkingDays(start: string, end: string): number {
  let count = 0
  const d = new Date(start)
  const endDate = new Date(end)
  while (d <= endDate) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase.from('conges')
    .select('*, type_conge:types_conge(nom)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conges: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('manager_id').eq('id', user.id).single()

  if (!profile?.manager_id) {
    return NextResponse.json({ error: 'Aucun responsable technique assigné à votre profil. Contactez les RH.' }, { status: 400 })
  }

  const body = await req.json()
  const { type_conge_id, date_debut, date_fin, motif } = body

  if (!date_debut || !date_fin) {
    return NextResponse.json({ error: 'Les dates de début et de fin sont obligatoires.' }, { status: 400 })
  }

  if (date_fin < date_debut) {
    return NextResponse.json({ error: 'La date de fin doit être après la date de début.' }, { status: 400 })
  }

  const nb_jours = countWorkingDays(date_debut, date_fin)

  const { data, error } = await supabase.from('conges').insert({
    profile_id: user.id,
    type_conge_id: type_conge_id || null,
    date_debut,
    date_fin,
    nb_jours,
    motif: motif || null,
    statut: 'en_attente',
    valideur_n1_id: profile.manager_id,
  }).select('*, type_conge:types_conge(nom)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('notifications').insert({
    user_id: profile.manager_id,
    titre: 'Nouvelle demande de congé',
    message: `Une demande de congé de ${nb_jours} jours ouvrables (${date_debut} → ${date_fin}) attend votre validation.`,
    lien: '/rh/conges',
  })

  return NextResponse.json({ conge: data })
}
