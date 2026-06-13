import { createClient as createServiceClient } from '@supabase/supabase-js'
import CongesRHClient from './CongesRHClient'

export const dynamic = 'force-dynamic'

export default async function CongesRHPage() {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conges } = await service
    .from('conges')
    .select('*, profile:profiles!profile_id(nom, prenoms, direction), type_conge:types_conge(nom)')
    .order('created_at', { ascending: false })
    .limit(200)

  return <CongesRHClient conges={conges ?? []} />
}
