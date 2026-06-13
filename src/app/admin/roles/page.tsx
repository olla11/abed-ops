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
  if (profile?.role !== 'admin') redirect('/admin')

  const preview = await getRolePreview()

  const { data: counts } = await supabase
    .from('profiles')
    .select('role')

  const roleCounts: Record<string, number> = {}
  for (const p of counts ?? []) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1
  }

  return <RolesClient currentPreview={preview} roleCounts={roleCounts} />
}
