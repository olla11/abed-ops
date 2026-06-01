import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PATCH /api/missions/[id] — mise a jour avant signature (caf/de/admin uniquement)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['caf', 'de', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('missions').select('status').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (!['brouillon', 'soumis'].includes(existing.status)) {
    return NextResponse.json({ error: 'Mission deja signee, edition impossible' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = [
    'objet', 'lieu', 'moyen_transport', 'conducteur_a_bord',
    'date_depart', 'date_arrivee_destination', 'date_depart_destination', 'date_retour',
    'imputation', 'a_charge_partenaire',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }

  const { error } = await supabase.from('missions').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/missions/[id] — suppression (admin uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'acces refuse — admin uniquement' }, { status: 403 })
  }

  const { error } = await supabase.from('missions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}