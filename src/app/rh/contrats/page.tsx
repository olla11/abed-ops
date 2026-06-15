import { createClient as createServiceClient } from '@supabase/supabase-js'
import ContratsClient from './ContratsClient'

export const dynamic = 'force-dynamic'

export default async function ContratsPage() {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: contrats }, { data: personnel }] = await Promise.all([
    service.from('contrats')
      .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
      .order('date_fin', { ascending: true }),
    service.from('profiles')
      .select('id, nom, prenoms, role, fonction')
      .order('prenoms'),
  ])

  return <ContratsClient contrats={contrats ?? []} personnel={personnel ?? []} />
}
