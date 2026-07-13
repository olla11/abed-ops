import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import EvaluationsListClient from './EvaluationsListClient'

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
    .select('nom, prenoms, role, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  // Évaluations où l'utilisateur est l'évalué ou l'évaluateur
  const { data: evaluations } = await service
    .from('evaluations')
    .select(`
      id, statut, declenchee_le, score_moyen,
      contrat:contrats(type_contrat, date_fin, poste)
    `)
    .or(`profile_id.eq.${user.id},evaluateur_id.eq.${user.id}`)
    .order('declenchee_le', { ascending: false })

  const showRH = profile?.role === 'rh'
  const showAdmin = profile?.role === 'admin'
  const showOverview = ['aaf', 'caf', 'de', 'dp', 'admin', 'administrateur'].includes(profile?.role ?? '')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        typeEmploi={(profile as any)?.type_emploi}
        showRH={showRH}
        showAdmin={showAdmin}
        avatarUrl={profile?.avatar_url}
      />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Retour</Link>
          <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>📝 Mes évaluations</h2>
        </div>

        <EvaluationsListClient evaluations={(evaluations ?? []) as any} />
      </div>
    </>
  )
}
