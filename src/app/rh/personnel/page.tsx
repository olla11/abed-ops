import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import PersonnelClient from './PersonnelClient'

export const dynamic = 'force-dynamic'

export default async function PersonnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: personnel } = await service
    .from('profiles')
    .select('id, nom, prenoms, role, type_emploi, direction, fonction, email, telephone, ifu, matricule, date_naissance, nationalite, adresse, manager_id, avatar_url')
    .order('prenoms')

  const { data: managers } = await service
    .from('profiles')
    .select('id, nom, prenoms')
    .in('role', ['admin', 'rh', 'de', 'caf', 'manager'])
    .order('prenoms')

  return <PersonnelClient personnel={personnel ?? []} managers={managers ?? []} />
}
