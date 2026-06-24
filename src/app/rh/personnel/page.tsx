import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile, getCachedPersonnel, getCachedManagers } from '@/lib/cache'
import PersonnelClient from './PersonnelClient'

export const dynamic = 'force-dynamic'

export default async function PersonnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const [personnel, managers] = await Promise.all([
    getCachedPersonnel(),
    getCachedManagers(),
  ])

  return <PersonnelClient personnel={personnel as any[]} managers={managers as any[]} />
}
