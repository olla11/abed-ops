export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import StatutPersonnel from '@/components/StatutPersonnel'

export default async function StatutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={role === 'admin'}
      />

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Suivi de mes dossiers</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Toutes vos soumissions en temps réel — timesheets, rapports, ordres de mission, demandes de paiement.
        </p>
      </div>

      <StatutPersonnel />
    </div>
  )
}
