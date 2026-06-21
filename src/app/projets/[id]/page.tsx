export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ProjetDetailClient from '@/components/ProjetDetailClient'

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

  const { data: projet, error: projetError } = await supabase
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

  const { data: allProfiles } = await supabase
    .from('profiles').select('id, nom, prenoms').order('prenoms')

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
      <ProjetDetailClient
        projet={projet as any}
        userId={user.id}
        allProfiles={allProfiles ?? []}
      />
    </>
  )
}
