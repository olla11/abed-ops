import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedEvaluations, getCachedPersonnel } from '@/lib/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { estRH } from '@/lib/roles'
import EvaluationsRHClient from './EvaluationsRHClient'

export const dynamic = 'force-dynamic'

const getContratsActifs = unstable_cache(
  async () => {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    // Un contrat peut faire partie d'une chaîne (Offre → Convention/Contrat →
    // Avenant) — seule la racine (sans contrat_parent_id) est un engagement
    // distinct à évaluer, sinon une personne apparaît plusieurs fois.
    // manager_id sert à préremplir l'évaluateur proposé dans le formulaire
    // de déclenchement (la RH garde la main pour le changer).
    const { data } = await service
      .from('contrats')
      .select('id, type_contrat, date_fin, poste, profile:profiles!profile_id(id, nom, prenoms, manager_id)')
      .eq('statut', 'actif')
      .is('contrat_parent_id', null)
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

  // Contrôle d'accès sur une lecture fraîche, jamais sur getCachedProfile
  // (jusqu'à 5 min de retard sur un changement de rôle) — un droit d'accès
  // ne doit jamais reposer sur une valeur qui peut être périmée.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  const [evaluations, contratsActifs, personnel] = await Promise.all([
    getCachedEvaluations(),
    getContratsActifs(),
    getCachedPersonnel(),
  ])

  return (
    <EvaluationsRHClient
      evaluations={evaluations as any[]}
      contratsActifs={contratsActifs as any[]}
      personnel={(personnel ?? []).map((p: any) => ({ id: p.id, nom: p.nom, prenoms: p.prenoms }))}
    />
  )
}
