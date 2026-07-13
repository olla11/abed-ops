import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isTraiteur = ['aaf', 'caf', 'de', 'dp', 'admin', 'administrateur', 'manager'].includes(role)

  let query = supabase
    .from('rapports_allocations')
    .select('*, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom,prenoms,email,type_emploi)')
    .order('created_at', { ascending: false })

  if (!isTraiteur) query = query.eq('prestataire_id', user.id)
  else if (role === 'manager') query = query.eq('manager_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('manager_id, type_emploi').eq('id', user.id).single()

  if (!profile?.manager_id) {
    return NextResponse.json({ error: 'Aucun responsable défini sur votre profil' }, { status: 400 })
  }

  const body = await req.json()
  const { periode_mois, periode_annee, rapport_texte, fichier_rapport_url } = body

  if (!periode_mois || !periode_annee || !rapport_texte) {
    return NextResponse.json({ error: 'Période et rapport requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('rapports_allocations').insert({
    prestataire_id: user.id,
    manager_id: profile.manager_id,
    periode_mois,
    periode_annee,
    rapport_texte,
    fichier_rapport_url: fichier_rapport_url ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('notifications').insert({
    user_id: profile.manager_id,
    titre: 'Rapport d\'allocation à valider',
    message: `Un rapport mensuel attend votre validation technique.`,
    lien: '/timesheets',
  })

  return NextResponse.json({ ok: true, id: data.id })
}
