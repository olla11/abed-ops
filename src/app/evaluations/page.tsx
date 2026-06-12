import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'

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

  const showRH = ['rh', 'admin'].includes(profile?.role ?? '')
  const showAdmin = profile?.role === 'admin'
  const showOverview = ['aaf', 'caf', 'de', 'admin', 'administrateur'].includes(profile?.role ?? '')

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
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Retour</Link>
          <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>📝 Mes évaluations</h2>
        </div>

        {(!evaluations || evaluations.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
            Aucune évaluation pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {evaluations.map((e: any) => {
              const s = STATUTS[e.statut] ?? { label: e.statut, color: '#6b7280', bg: '#f3f4f6' }
              return (
                <div key={e.id} style={{
                  background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10,
                  padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {e.contrat?.poste ?? 'Poste N/A'} — {e.contrat?.type_contrat ?? ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 4 }}>
                      Fin contrat : {e.contrat?.date_fin ?? 'N/A'} · Déclenchée le : {e.declenchee_le ? new Date(e.declenchee_le).toLocaleDateString('fr-FR') : 'N/A'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {e.score_moyen != null && (
                      <span style={{ fontWeight: 700, color: 'var(--abed-green)' }}>{Number(e.score_moyen).toFixed(1)}/5</span>
                    )}
                    <span style={{
                      background: s.bg, color: s.color,
                      borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 600,
                    }}>
                      {s.label}
                    </span>
                    <Link href={`/evaluations/${e.id}`} style={{
                      padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
                    }}>
                      Ouvrir →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
