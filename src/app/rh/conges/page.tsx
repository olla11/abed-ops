import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile, getCachedCongesRH } from '@/lib/cache'
import CongesRHClient from './CongesRHClient'

export const dynamic = 'force-dynamic'

export default async function CongesRHPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  const role = me?.role ?? ''

  const conges = await getCachedCongesRH()

  return <CongesRHClient conges={conges as any[]} role={role} />
}
