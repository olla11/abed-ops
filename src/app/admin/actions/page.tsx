export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import ActionsClient from './ActionsClient'

export default async function ActionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, civilite, nom, prenoms, email, role, type_emploi, fonction, manager_id')
    .order('nom')

  const managers = (users ?? []).filter(u => ['manager', 'caf', 'de', 'dp', 'admin'].includes(u.role ?? ''))

  return (
    <ActionsClient
      users={users ?? []}
      managers={managers}
      currentRole={profile?.role ?? ''}
    />
  )
}
