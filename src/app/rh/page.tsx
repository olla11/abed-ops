import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getCachedProfile, getCachedPersonnel, getCachedContrats, getCachedCongesRH, getCachedEvaluations } from '@/lib/cache'
import RHDashboardClient from './RHDashboardClient'

export const dynamic = 'force-dynamic'

export default async function RHDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const now = new Date()
  const currentMois = now.getMonth() + 1
  const currentAnnee = now.getFullYear()

  const getCongesCount = unstable_cache(
    async () => {
      const { count } = await service.from('conges').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente')
      return count ?? 0
    },
    ['conges-en-attente-count'],
    { tags: ['conges'], revalidate: 120 }
  )

  const getActiveMois = unstable_cache(
    async () => {
      const { count } = await service.from('rapports_allocations')
        .select('prestataire_id', { count: 'exact', head: true })
        .eq('periode_mois', currentMois)
        .eq('periode_annee', currentAnnee)
      return count ?? 0
    },
    [`activite-mois-${currentMois}-${currentAnnee}`],
    { tags: ['rapports-allocations'], revalidate: 600 }
  )

  const [personnel, contrats, congesRecents, evaluations, congesEnAttenteCount, activeMoisCount] = await Promise.all([
    getCachedPersonnel(),
    getCachedContrats(),
    getCachedCongesRH().then(d => d.slice(0, 15)),
    getCachedEvaluations().then(d => d.slice(0, 10)),
    getCongesCount(),
    getActiveMois(),
  ])

  const contratsExpirants = (contrats ?? []).filter((c: any) =>
    c.statut === 'actif' && c.date_fin && c.date_fin <= in30 && c.date_fin >= today
  )

  const totalActifs = (personnel ?? []).filter((p: any) => p.type_emploi && p.type_emploi !== 'non défini').length
  const tauxActivite = totalActifs > 0 ? Math.round(((activeMoisCount ?? 0) / totalActifs) * 100) : 0

  return (
    <RHDashboardClient
      personnel={personnel as any[]}
      contrats={(contrats ?? []) as any[]}
      contratsExpirants={contratsExpirants as any[]}
      congesRecents={(congesRecents ?? []) as any[]}
      congesEnAttenteCount={congesEnAttenteCount ?? 0}
      evaluations={(evaluations ?? []) as any[]}
      tauxActivite={tauxActivite}
      activeMoisCount={activeMoisCount ?? 0}
      totalActifs={totalActifs}
    />
  )
}
