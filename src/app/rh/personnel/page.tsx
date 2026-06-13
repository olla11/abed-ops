import { createClient as createServiceClient } from '@supabase/supabase-js'
import PersonnelClient from './PersonnelClient'

export const dynamic = 'force-dynamic'

export default async function PersonnelPage() {
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
