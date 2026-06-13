import { createClient as createServiceClient } from '@supabase/supabase-js'
import RHDashboardClient from './RHDashboardClient'

export const dynamic = 'force-dynamic'

export default async function RHDashboardPage() {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [
    { data: personnel },
    { data: contrats },
    { data: congesRecents },
    { data: evaluations },
    { data: congesEnAttente },
  ] = await Promise.all([
    service.from('profiles')
      .select('id, nom, prenoms, role, type_emploi, direction, fonction')
      .not('role', 'in', '("admin","rh")')
      .order('prenoms'),
    service.from('contrats')
      .select('id, type_contrat, statut, date_fin, date_debut, direction, poste, profile_id, profile:profiles!profile_id(nom, prenoms)')
      .order('date_fin', { ascending: true })
      .limit(200),
    service.from('conges')
      .select('id, statut, date_debut, date_fin, nb_jours, created_at, profile:profiles!profile_id(nom, prenoms, direction), type_conge:types_conge(nom)')
      .order('created_at', { ascending: false })
      .limit(15),
    service.from('evaluations')
      .select('id, statut, score_moyen, declenchee_le, profile:profiles!profile_id(nom, prenoms)')
      .order('declenchee_le', { ascending: false })
      .limit(10),
    service.from('conges')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente'),
  ])

  const contratsExpirants = (contrats ?? []).filter((c: any) =>
    c.statut === 'actif' && c.date_fin && c.date_fin <= in30 && c.date_fin >= today
  )

  return (
    <RHDashboardClient
      personnel={personnel ?? []}
      contrats={contrats ?? []}
      contratsExpirants={contratsExpirants}
      congesRecents={congesRecents ?? []}
      congesEnAttenteCount={congesEnAttente ?? 0}
      evaluations={evaluations ?? []}
    />
  )
}
