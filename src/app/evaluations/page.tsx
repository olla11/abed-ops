import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import EvaluationsListClient from './EvaluationsListClient'
import { estRH, estAAF } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:           { label: 'En attente',          color: '#92400e', bg: '#fffbeb' },
  evaluateur_complete:  { label: 'Évaluateur complété', color: '#1e40af', bg: '#eff6ff' },
  evalue_complete:      { label: 'À commenter',         color: '#6b21a8', bg: '#faf5ff' },
  responsable_complete: { label: 'Responsable signé',   color: '#92400e', bg: '#fffbeb' },
  cloture:              { label: 'Clôturé',             color: '#166534', bg: '#f0fdf4' },
}

export default async function MesEvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await service
    .from('profiles')
    .select('nom, prenoms, role, titre, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  // Évaluations où l'utilisateur est l'évalué, l'évaluateur, ou le
  // responsable de département assigné (Section VIII) — et, pour CAF/DE/DP
  // qui rendent une décision en Section X, tous les dossiers arrivés à ce
  // stade (responsable_complete/cloture) même sans lien personnel avec le
  // dossier, sinon ils n'ont aucun moyen de les retrouver dans le système.
  const role = profile?.role ?? ''
  const isDecideur = ['caf', 'de', 'dp'].includes(role)
  const orFilter = isDecideur
    ? `profile_id.eq.${user.id},evaluateur_id.eq.${user.id},responsable_id.eq.${user.id},statut.eq.responsable_complete,statut.eq.cloture`
    : `profile_id.eq.${user.id},evaluateur_id.eq.${user.id},responsable_id.eq.${user.id}`

  const { data: evaluations } = await service
    .from('evaluations')
    .select(`
      id, statut, declenchee_le, score_moyen, profile_id, evaluateur_id, responsable_id,
      decision_caf, decision_de,
      profile:profiles!profile_id(nom, prenoms),
      contrat:contrats(type_contrat, date_fin, poste)
    `)
    .or(orFilter)
    .order('declenchee_le', { ascending: false })

  const showRH = estRH(profile?.role)
  const showAAF = estAAF(profile?.role)
  const showAdmin = ['admin', 'superadmin'].includes(profile?.role ?? '')
  const showOverview = ['aaf', 'caf', 'de', 'dp', 'admin', 'administrateur'].includes(profile?.role ?? '')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        userTitre={profile?.titre}
        typeEmploi={(profile as any)?.type_emploi}
        showRH={showRH}
        showAAF={showAAF}
        showAdmin={showAdmin}
        avatarUrl={profile?.avatar_url}
      />
      <div className="page-container">
        <div style={{ marginBottom: 4 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Retour</Link>
        </div>

        <EvaluationsListClient evaluations={(evaluations ?? []) as any} myId={user.id} myRole={role} />
      </div>
    </>
  )
}
