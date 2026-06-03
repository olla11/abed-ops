import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('manager_id').eq('id', user.id).single()

  if (!profile?.manager_id) {
    return NextResponse.json({ error: 'Aucun responsable technique assigné à votre profil.' }, { status: 400 })
  }

  const body = await req.json()
  const { titre, periode_mois, periode_annee, heures_declarees,
          fichier_timesheet_url, fichier_livrable_url, fichier_facture_url } = body

  if (!titre || !periode_mois || !periode_annee || !heures_declarees) {
    return NextResponse.json({ error: 'Titre, période et heures déclarées sont obligatoires.' }, { status: 400 })
  }
  if (!fichier_timesheet_url || !fichier_livrable_url || !fichier_facture_url) {
    return NextResponse.json({ error: 'Les trois fichiers sont obligatoires (timesheet Excel, livrable PDF, facture PDF).' }, { status: 400 })
  }

  const { data, error } = await supabase.from('soumissions').insert({
    prestataire_id: user.id,
    manager_id: profile.manager_id,
    titre,
    type: 'timesheet',
    periode_mois,
    periode_annee,
    heures_declarees,
    fichier_timesheet_url,
    fichier_livrable_url,
    fichier_facture_url,
    status: 'soumis',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notification au manager
  await supabase.from('notifications').insert({
    user_id: profile.manager_id,
    titre: 'Nouveau timesheet à valider',
    message: `${titre} — ${heures_declarees}h déclarées pour ${periode_mois}/${periode_annee}`,
    lien: '/timesheets',
  })

  return NextResponse.json({ ok: true, id: data.id })
}
