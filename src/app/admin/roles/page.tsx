export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import RolesClient from './RolesClient'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin')

  const preview = await getRolePreview()
  const isSuperadmin = profile?.role === 'superadmin'

  const { data: counts } = await supabase
    .from('profiles')
    .select('role')

  const roleCounts: Record<string, number> = {}
  for (const p of counts ?? []) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1
  }

  // La liste des cibles pour "Se connecter en tant que" n'est utile qu'au superadmin
  // (seul rôle autorisé par /api/admin/impersonate) — on évite de la charger sinon.
  let impersonationTargets: { id: string; nom: string; prenoms: string; role: string }[] = []
  if (isSuperadmin) {
    const { data: targets } = await supabase
      .from('profiles')
      .select('id, nom, prenoms, role')
      .neq('role', 'superadmin')
      .eq('archived', false)
      .order('nom')
    impersonationTargets = targets ?? []
  }

  return (
    <RolesClient
      currentPreview={preview}
      roleCounts={roleCounts}
      isSuperadmin={isSuperadmin}
      impersonationTargets={impersonationTargets}
    />
  )
}
