import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return NextResponse.json({ error: 'accès réservé au superadmin' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const actorId = sp.get('actor_id')
  const q = sp.get('q')?.trim()
  const from = sp.get('from')
  const to = sp.get('to')
  const page = Math.max(0, Number(sp.get('page') ?? '0') || 0)

  let query = supabase
    .from('audit_log')
    .select('id, actor_id, actor_nom, actor_prenoms, actor_role, method, path, ip, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (actorId) query = query.eq('actor_id', actorId)
  if (q) query = query.ilike('path', `%${q}%`)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count: count ?? 0, page, pageSize: PAGE_SIZE })
}
