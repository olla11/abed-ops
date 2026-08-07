import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import RHParametresClient from './RHParametresClient'

export const dynamic = 'force-dynamic'

export default async function RHParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!(estRH(me?.role) || me?.role === 'admin')) redirect('/rh/conges')

  return <RHParametresClient />
}
