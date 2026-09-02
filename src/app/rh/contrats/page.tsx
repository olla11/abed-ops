import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getCachedProfile, getCachedContrats, getCachedPersonnel } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import ContratsClient from './ContratsClient'

export const dynamic = 'force-dynamic'

export default async function ContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  const [contrats, personnel] = await Promise.all([
    getCachedContrats(),
    getCachedPersonnel(),
  ])

  return (
    <Suspense>
      <ContratsClient contrats={contrats as any[]} personnel={personnel as any[]} />
    </Suspense>
  )
}
