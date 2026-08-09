export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import ProjetDetailClient from '@/components/ProjetDetailClient'
import ProjetsSidebar from '@/components/ProjetsSidebar'
import { estRH } from '@/lib/roles'

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
  const impersonation = await getImpersonationInfo()

  const { data: projet } = await supabase
    .from('projets_internes')
    .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(id, nom, prenoms),
      activites(*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms),
      created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms),
      commentaires_activites(id))`)
    .eq('id', id)
    .single()

  // RLS (projets_select / can_access_projet) ne renvoie déjà que les projets
  // accessibles à l'utilisateur (public/créateur/assigné, ou membre de l'espace).
  if (!projet) redirect('/projets')

  // Comme pour les TDR : le RLS de `profiles` masque les autres personnes
  // pour un rôle non privilégié, donc le créateur/assigné d'une activité
  // peut ressortir `null` du embed ci-dessus. On complète via l'annuaire.
  {
    const idsReferences = new Set<string>()
    if ((projet as any).created_by) idsReferences.add((projet as any).created_by)
    for (const a of (projet as any).activites ?? []) {
      if (a.assignee_id) idsReferences.add(a.assignee_id)
      if (a.created_by) idsReferences.add(a.created_by)
    }
    if (idsReferences.size > 0) {
      const { data: annuaire } = await supabase
        .from('profiles_annuaire').select('id, nom, prenoms').in('id', [...idsReferences])
      const parId = new Map((annuaire ?? []).map(p => [p.id, p]))
      if (!(projet as any).created_by_profile && (projet as any).created_by) {
        (projet as any).created_by_profile = parId.get((projet as any).created_by) ?? null
      }
      for (const a of (projet as any).activites ?? []) {
        if (!a.assignee && a.assignee_id) a.assignee = parId.get(a.assignee_id) ?? null
        if (!a.created_by_profile && a.created_by) a.created_by_profile = parId.get(a.created_by) ?? null
      }
    }
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
    const { data: allP } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').eq('archived', false).order('prenoms')
    assignableProfiles = allP ?? []
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
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
