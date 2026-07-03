import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile, getCachedEvaluations } from '@/lib/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import EvaluationsRHClient from './EvaluationsRHClient'

export const dynamic = 'force-dynamic'

const getContratsActifs = unstable_cache(
  async () => {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await service
      .from('contrats')
      .select('id, type_contrat, date_fin, poste, profile:profiles!profile_id(id, nom, prenoms)')
      .eq('statut', 'actif')
      .not('date_fin', 'is', null)
      .order('date_fin', { ascending: true })
    return data ?? []
  },
  ['contrats-actifs'],
  { tags: ['contrats'], revalidate: 300 }
)

export default async function EvaluationsRHPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const [evaluations, contratsActifs] = await Promise.all([
    getCachedEvaluations(),
    getContratsActifs(),
  ])

  return (
    <EvaluationsRHClient
      evaluations={evaluations as any[]}
      contratsActifs={contratsActifs as any[]}
    />
  )
}
