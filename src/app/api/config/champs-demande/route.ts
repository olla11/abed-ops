import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function checkCaf(supabase: any, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return ['caf', 'admin', 'administrateur'].includes(data?.role ?? '')
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('champs_demande')
    .select('*')
    .eq('actif', true)
    .order('ordre')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

// Sauvegarde complète : remplace tous les champs par la liste envoyée
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  if (!await checkCaf(supabase, user.id)) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const { champs }: { champs: Array<{
    id?: string; label: string; type: string; required: boolean; options: string[]; ordre: number
  }> } = await req.json()

  if (!Array.isArray(champs)) return NextResponse.json({ error: 'champs requis' }, { status: 400 })

  // Soft-delete tous les champs existants
  await supabase.from('champs_demande').update({ actif: false }).eq('actif', true)

  // Réinsérer la liste complète dans le bon ordre
  if (champs.length > 0) {
    const rows = champs.map((c, i) => ({
      label: c.label.trim(),
      type: c.type,
      required: c.required,
      options: c.options ?? [],
      ordre: i,
      actif: true,
    }))
    const { error } = await supabase.from('champs_demande').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  if (!await checkCaf(supabase, user.id)) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabase.from('champs_demande').update({ actif: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
