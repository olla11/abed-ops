import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return NextResponse.json({ error: 'accès réservé au superadmin' }, { status: 403 })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [todayRes, weekRes, recentRes] = await Promise.all([
    supabase.from('audit_log').select('actor_id', { count: 'exact', head: false }).gte('created_at', startOfToday),
    supabase.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('audit_log')
      .select('actor_id, actor_nom, actor_prenoms, actor_role, method, path, created_at')
      .not('actor_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const todayCount = todayRes.count ?? 0
  const activeToday = new Set((todayRes.data ?? []).map(r => r.actor_id)).size
  const weekCount = weekRes.count ?? 0

  const seen = new Set<string>()
  const recentUsers: any[] = []
  for (const r of recentRes.data ?? []) {
    if (!r.actor_id || seen.has(r.actor_id)) continue
    seen.add(r.actor_id)
    recentUsers.push(r)
    if (recentUsers.length >= 5) break
  }

  return NextResponse.json({ todayCount, activeToday, weekCount, recentUsers })
}
