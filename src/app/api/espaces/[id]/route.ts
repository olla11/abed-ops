import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { data, error } = await supabase.from('espaces')
    .update({ ...(body.nom && { nom: body.nom }), ...(body.couleur && { couleur: body.couleur }), ...(body.icon && { icon: body.icon }) })
    .eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  // projets_internes.espace_id est en ON DELETE SET NULL : les projets liés
  // sont automatiquement déliés par Postgres, pas besoin de le faire ici.
  // RLS (espaces_delete) restreint la suppression au créateur de l'espace.
  const { data, error } = await supabase.from('espaces').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  return NextResponse.json({ ok: true })
}
