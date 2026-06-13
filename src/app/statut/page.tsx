export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import StatutPersonnel from '@/components/StatutPersonnel'

export default async function StatutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, must_change_password, avatar_url').eq('id', user.id).single()

  if (profile?.must_change_password) redirect('/auth/changer-mot-de-passe')

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={['rh','admin'].includes(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px', display: 'grid', gap: 28 }}>

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Suivi de mes dossiers</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Toutes vos soumissions en temps réel — timesheets, rapports, ordres de mission, demandes de paiement.
        </p>
      </div>

      <StatutPersonnel />
      </div>
    </>
  )
}
