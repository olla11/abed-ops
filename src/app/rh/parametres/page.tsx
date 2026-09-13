import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { estRH } from '@/lib/roles'
import RHParametresClient from './RHParametresClient'

export const dynamic = 'force-dynamic'

export default async function RHParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Contrôle d'accès sur une lecture fraîche, jamais sur getCachedProfile
  // (jusqu'à 5 min de retard sur un changement de rôle) — un droit d'accès
  // ne doit jamais reposer sur une valeur qui peut être périmée.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  return <RHParametresClient role={me?.role ?? ''} />
}
