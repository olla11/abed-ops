import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin', 'de'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const { type_contrat, poste, direction, date_debut, date_fin, salaire_brut, observations } = body

  const admin = createAdminClient()
  const { data, error } = await admin.from('contrats')
    .update({ type_contrat, poste: poste || null, direction: direction || null, date_debut, date_fin: date_fin || null, salaire_brut: salaire_brut || null, observations: observations || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('statut', 'actif')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contrat: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin', 'de'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  if (body.action !== 'resilier') return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })

  const { motif } = body
  if (!motif || motif.trim().length < 20) return NextResponse.json({ error: 'Le motif de résiliation est obligatoire (minimum 20 caractères).' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('contrats')
    .update({ statut: 'resilie', motif_resiliation: motif.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contrat: data })
}
