import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile, getCachedContrats, getCachedPersonnel } from '@/lib/cache'
import ContratsClient from './ContratsClient'

export const dynamic = 'force-dynamic'

export default async function ContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const [contrats, personnel] = await Promise.all([
    getCachedContrats(),
    getCachedPersonnel(),
  ])

  return <ContratsClient contrats={contrats as any[]} personnel={personnel as any[]} />
}
