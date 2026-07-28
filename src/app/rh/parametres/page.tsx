import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/cache'
import RHParametresClient from './RHParametresClient'

export const dynamic = 'force-dynamic'

export default async function RHParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  return <RHParametresClient />
}
