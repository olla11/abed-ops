export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ReconciliationForm from '@/components/ReconciliationForm'
import AppHeader from '@/components/AppHeader'
import Link from 'next/link'

export default async function ReconciliationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mission } = await supabase
    .from('missions')
    .select('id, objet, lieu, status, missionnaire_id, a_charge_partenaire, reconciliation_commentaire')
    .eq('id', id)
    .single()

  if (!mission) redirect('/dashboard')
  if (mission.missionnaire_id !== user.id) redirect('/dashboard')

  // Autoriser la soumission et la resoumission après rejet CAF
  if (!['signe', 'en_mission', 'reconciliation'].includes(mission.status)) {
    redirect(`/missions/${id}`)
  }

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        showAdmin={profile?.role === 'admin'}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={`/missions/${id}`} style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Réconciliation</h2>
      </div>
      <p style={{ color: 'var(--abed-muted)', marginBottom: 24 }}>
        Mission : <strong>{mission.objet}</strong> — {mission.lieu}
        {mission.a_charge_partenaire && (
          <span style={{ marginLeft: 10, color: 'var(--abed-amber)' }}>
            ⚠ Mission à charge partenaire — prélèvement 20 % applicable
          </span>
        )}
      </p>
      <ReconciliationForm
        missionId={mission.id}
        aChargePartenaire={mission.a_charge_partenaire}
        commentaireRejet={mission.reconciliation_commentaire}
      />
    </div>
  )
}
