import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import RHDashboardClient from './RHDashboardClient'

export const dynamic = 'force-dynamic'

export default async function RHDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  // Personnel : select only base columns that always exist
  // Columns like direction/matricule require migration_022 to be run
  const { data: personnel, error: personnelError } = await service
    .from('profiles')
    .select('id, nom, prenoms, role, type_emploi, fonction')
    .neq('role', 'admin')
    .order('prenoms')

  if (personnelError) {
    console.error('[RH dashboard] personnel error:', personnelError.message)
  }

  // Try to add direction column — may not exist before migration_022
  let personnelWithDirection = personnel ?? []
  if (!personnelError) {
    const { data: withDir } = await service
      .from('profiles')
      .select('id, nom, prenoms, role, type_emploi, fonction, direction')
      .neq('role', 'admin')
      .order('prenoms')
    if (withDir) personnelWithDirection = withDir
  }

  // These tables require migrations 023/024/025 to exist
  const [
    { data: contrats },
    { data: congesRecents },
    { data: evaluations },
    { count: congesEnAttenteCount },
  ] = await Promise.all([
    service.from('contrats')
      .select('id, type_contrat, statut, date_fin, date_debut, poste, profile_id, profile:profiles!profile_id(nom, prenoms)')
      .order('date_fin', { ascending: true })
      .limit(200),
    service.from('conges')
      .select('id, statut, date_debut, date_fin, nb_jours, created_at, profile:profiles!profile_id(nom, prenoms), type_conge:types_conge(nom)')
      .order('created_at', { ascending: false })
      .limit(15),
    service.from('evaluations')
      .select('id, statut, score_moyen, declenchee_le, profile:profiles!profile_id(nom, prenoms)')
      .order('declenchee_le', { ascending: false })
      .limit(10),
    service.from('conges')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'en_attente'),
  ])

  const contratsExpirants = (contrats ?? []).filter((c: any) =>
    c.statut === 'actif' && c.date_fin && c.date_fin <= in30 && c.date_fin >= today
  )

  return (
    <RHDashboardClient
      personnel={personnelWithDirection as any[]}
      contrats={(contrats ?? []) as any[]}
      contratsExpirants={contratsExpirants as any[]}
      congesRecents={(congesRecents ?? []) as any[]}
      congesEnAttenteCount={congesEnAttenteCount ?? 0}
      evaluations={(evaluations ?? []) as any[]}
    />
  )
}
