import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import EvaluationsRHClient from './EvaluationsRHClient'

export const dynamic = 'force-dynamic'

export default async function EvaluationsRHPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: evaluations } = await service
    .from('evaluations')
    .select(`
      id, statut, declenchee_le, score_moyen,
      profile:profiles!profile_id(id, nom, prenoms),
      contrat:contrats(id, type_contrat, date_fin, poste)
    `)
    .order('declenchee_le', { ascending: false })

  // Contrats actifs pour modal déclenchement
  const { data: contratsActifs } = await service
    .from('contrats')
    .select('id, type_contrat, date_fin, poste, profile:profiles!profile_id(id, nom, prenoms)')
    .eq('statut', 'actif')
    .not('date_fin', 'is', null)
    .order('date_fin', { ascending: true })

  return (
    <EvaluationsRHClient
      evaluations={(evaluations ?? []) as any[]}
      contratsActifs={(contratsActifs ?? []) as any[]}
    />
  )
}
