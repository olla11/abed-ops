export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ProjetsSidebar from '@/components/ProjetsSidebar'

export default async function ProjetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

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
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <div style={{ display: 'flex' }}>
        <div className="projets-sidebar"><ProjetsSidebar /></div>
        <div className="projets-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', color: '#9ca3af', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: 0 }}>Sélectionnez un projet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Choisissez un projet dans la barre latérale ou créez-en un nouveau.</p>
        </div>
      </div>
    </>
  )
}
