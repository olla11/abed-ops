import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin', 'de'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await service.from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .order('date_fin', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contrats: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const { profile_id, type_contrat, date_debut, poste, direction, date_fin, salaire_brut, observations } = body

  if (!profile_id || !type_contrat || !date_debut) {
    return NextResponse.json({ error: 'Employé, type et date de début sont obligatoires.' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await service.from('contrats').insert({
    profile_id, type_contrat, date_debut, poste: poste || null,
    direction: direction || null, date_fin: date_fin || null,
    salaire_brut: salaire_brut || null, observations: observations || null,
    statut: 'actif',
  }).select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contrat: data })
}
