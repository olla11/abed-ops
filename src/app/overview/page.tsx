export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import OverviewOperations from '@/components/OverviewOperations'

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? ''
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  if (!['aaf','caf','de','dp','admin','administrateur'].includes(role)) redirect('/timesheets')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <div className="page-container" style={{ display: 'grid', gap: 28 }}>

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Vue d'ensemble des opérations</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Tous les dossiers en cours et clôturés — timesheets, rapports mensuels, ordres de mission, demandes de paiement.
        </p>
      </div>

      <OverviewOperations role={role} />
      </div>
    </>
  )
}