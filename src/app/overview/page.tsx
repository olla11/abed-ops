export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import OverviewOperations from '@/components/OverviewOperations'

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()

  const role = profile?.role ?? ''
  if (!['aaf','caf','de','admin','administrateur'].includes(role)) redirect('/timesheets')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={role === 'admin'}
      />

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Vue d'ensemble des opérations</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Tous les dossiers en cours et clôturés — timesheets, rapports mensuels, ordres de mission, demandes de paiement.
        </p>
      </div>

      <OverviewOperations />
    </div>
  )
}
