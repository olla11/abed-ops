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
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const role = profile?.role ?? ''
  if (!['aaf','caf','de','admin','administrateur'].includes(role)) redirect('/timesheets')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={role === 'admin'}
        showRH={['rh','admin'].includes(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px", display: "grid", gap: 28 }}>

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Vue d'ensemble des opérations</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Tous les dossiers en cours et clôturés — timesheets, rapports mensuels, ordres de mission, demandes de paiement.
        </p>
      </div>

      <OverviewOperations />
      </div>
    </>
  )
}