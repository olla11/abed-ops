import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { resolveModule } from '@/lib/audit-log-labels'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return NextResponse.json({ error: 'accès réservé au superadmin' }, { status: 403 })

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows } = await supabase
    .from('audit_log')
    .select('path, actor_id, actor_role, created_at')
    .gte('created_at', since)
    .limit(20000)

  const list = rows ?? []

  // Activité par jour + utilisateurs actifs par jour
  const byDay = new Map<string, { count: number; users: Set<string> }>()
  // Usage par module
  const byModule = new Map<string, { label: string; count: number }>()
  // Activité par rôle
  const byRole = new Map<string, number>()
  const activeUsers = new Set<string>()

  for (const r of list) {
    const day = r.created_at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, { count: 0, users: new Set() })
    const d = byDay.get(day)!
    d.count++
    if (r.actor_id) { d.users.add(r.actor_id); activeUsers.add(r.actor_id) }

    const mod = resolveModule(r.path)
    if (!byModule.has(mod.key)) byModule.set(mod.key, { label: mod.label, count: 0 })
    byModule.get(mod.key)!.count++

    if (r.actor_role) byRole.set(r.actor_role, (byRole.get(r.actor_role) ?? 0) + 1)
  }

  const dailyActivity = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, count: d.count, activeUsers: d.users.size }))

  const moduleUsage = [...byModule.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const roleUsage = [...byRole.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([role, count]) => ({ role, count }))

  return NextResponse.json({
    days,
    totalActions: list.length,
    activeUsers: activeUsers.size,
    dailyActivity,
    moduleUsage,
    roleUsage,
  })
}
