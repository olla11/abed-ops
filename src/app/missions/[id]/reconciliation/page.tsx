export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ReconciliationForm from '@/components/ReconciliationForm'

export default async function ReconciliationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mission } = await supabase
    .from('missions')
    .select('id, objet, lieu, status, missionnaire_id, a_charge_partenaire')
    .eq('id', params.id)
    .single()

  if (!mission) redirect('/dashboard')
  if (mission.missionnaire_id !== user.id) redirect('/dashboard')
  if (!['signe', 'en_mission', 'reconciliation'].includes(mission.status)) {
    redirect(`/missions/${params.id}`)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 32 }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 8 }}>Réconciliation</h2>
      <p style={{ color: 'var(--abed-muted)', marginBottom: 24 }}>
        Mission : <strong>{mission.objet}</strong> — {mission.lieu}
        {mission.a_charge_partenaire && (
          <span style={{ marginLeft: 10, color: 'var(--abed-amber)' }}>
            ⚠ Mission à charge partenaire — prélèvement 20 % applicable
          </span>
        )}
      </p>
      <ReconciliationForm missionId={mission.id} aChargePartenaire={mission.a_charge_partenaire} />
    </div>
  )
}
