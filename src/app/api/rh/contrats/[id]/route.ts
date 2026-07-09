import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { revalidateTag } from 'next/cache'

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
  const { type_contrat, poste, direction, date_debut, date_fin, salaire_brut, observations, objet, articles, commentaires_rh } = body

  const admin = createAdminClient()
  const { data, error } = await admin.from('contrats')
    .update({
      type_contrat,
      poste: poste || null,
      direction: direction || null,
      date_debut,
      date_fin: date_fin || null,
      salaire_brut: salaire_brut || null,
      observations: observations || null,
      objet: objet || null,
      articles: articles ?? [],
      commentaires_rh: commentaires_rh || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('statut', 'actif')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('contrats')
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

  const body = await req.json()

  const admin = createAdminClient()

  // Employee comment action — any authenticated user who is the contract owner
  if (body.action === 'commenter') {
    const { commentaire } = body
    if (!commentaire || commentaire.trim().length < 2) {
      return NextResponse.json({ error: 'Commentaire trop court.' }, { status: 400 })
    }

    // Verify the user owns this contract or is rh/admin/de
    const { data: contrat } = await admin.from('contrats').select('profile_id').eq('id', id).single()
    if (!contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isOwner = contrat.profile_id === user.id
    const isRH = ['rh', 'admin', 'de'].includes(me?.role ?? '')
    if (!isOwner && !isRH) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const field = isOwner && !isRH ? 'commentaires_employe' : 'commentaires_rh'

    const { data, error } = await admin.from('contrats')
      .update({ [field]: commentaire.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, commentaires_employe, commentaires_rh')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    revalidateTag('contrats')
    return NextResponse.json({ contrat: data })
  }

  // Resilier action
  if (body.action === 'resilier') {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['rh', 'admin', 'de'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { motif } = body
    if (!motif || motif.trim().length < 20) return NextResponse.json({ error: 'Le motif de résiliation est obligatoire (minimum 20 caractères).' }, { status: 400 })

    const { data, error } = await admin.from('contrats')
      .update({ statut: 'resilie', motif_resiliation: motif.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    revalidateTag('contrats')
    return NextResponse.json({ contrat: data })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('contrats').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('contrats')
  return NextResponse.json({ ok: true })
}
