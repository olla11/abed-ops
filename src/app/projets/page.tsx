export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ProjetsClient from '@/components/ProjetsClient'

export default async function ProjetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const { createAdminClient } = await import('@/lib/supabase-server')
  const admin = createAdminClient()

  const { data: ownAndPublic } = await admin
    .from('projets_internes')
    .select('*, created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms), activites(id, statut, assignee_id, parent_id)')
    .or(`is_public.eq.true,created_by.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const { data: assignedActivites } = await admin
    .from('activites')
    .select('projet_id')
    .eq('assignee_id', user.id)

  const assignedProjectIds = [...new Set((assignedActivites ?? []).map((a: { projet_id: string }) => a.projet_id))]
  const alreadyIncluded = new Set((ownAndPublic ?? []).map((p: { id: string }) => p.id))
  const missingIds = assignedProjectIds.filter((id: string) => !alreadyIncluded.has(id))

  let extraProjects: typeof ownAndPublic = []
  if (missingIds.length > 0) {
    const { data: ep } = await admin
      .from('projets_internes')
      .select('*, created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms), activites(id, statut, assignee_id, parent_id)')
      .in('id', missingIds)
      .eq('is_public', false)
    extraProjects = ep ?? []
  }

  const projets = [...(ownAndPublic ?? []), ...extraProjects]

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
      <ProjetsClient projets={projets ?? []} userId={user.id} />
    </>
  )
}
