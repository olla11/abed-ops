export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ProjetDetailClient from '@/components/ProjetDetailClient'
import ProjetsSidebar from '@/components/ProjetsSidebar'

export default async function ProjetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const { data: projet } = await supabase
    .from('projets_internes')
    .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(id, nom, prenoms),
      activites(*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms),
      created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms),
      commentaires_activites(id))`)
    .eq('id', id)
    .single()

  if (!projet) redirect('/projets')

  // Access control: private project only visible to creator or assignees
  if (projet.is_public === false && projet.created_by !== user.id) {
    const hasTask = (projet.activites as Array<{ assignee_id: string | null }>)
      .some(a => a.assignee_id === user.id)
    if (!hasTask) redirect('/projets')
  }

  // Fetch espace members if project belongs to an espace
  let assignableProfiles: { id: string; nom: string; prenoms: string }[] = []
  const { createAdminClient } = await import('@/lib/supabase-server')
  const admin = createAdminClient()

  if (projet?.espace_id) {
    const { data: espMembres } = await admin
      .from('espace_membres')
      .select('profile:profiles!espace_membres_profile_id_fkey(id, nom, prenoms)')
      .eq('espace_id', projet.espace_id)
    assignableProfiles = (espMembres ?? []).map(m => m.profile).filter(Boolean) as typeof assignableProfiles
  } else {
    const { data: allP } = await supabase.from('profiles').select('id, nom, prenoms').order('prenoms')
    assignableProfiles = allP ?? []
  }

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
        <div className="projets-main" style={{ minWidth: 0 }}>
          <ProjetDetailClient
            projet={projet as any}
            userId={user.id}
            allProfiles={assignableProfiles}
          />
        </div>
      </div>
    </>
  )
}
