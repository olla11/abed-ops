export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import GestionCAF from '@/components/GestionCAF'

export default async function ParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? ''
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  if (!['caf', 'admin'].includes(role)) redirect('/timesheets')

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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Paramètres</h1>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
            Taux horaires et listes utilisées dans les formulaires de demande de paiement.
          </p>
        </div>
        <GestionCAF />
      </div>
    </>
  )
}
