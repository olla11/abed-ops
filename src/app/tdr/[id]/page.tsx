export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import TdrDetailClient from './TdrDetailClient'

export default async function TdrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const { data: tdr } = await supabase
    .from('tdrs')
    .select(`*,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms, fonction),
      responsable_technique:profiles!tdrs_responsable_technique_id_fkey(id, nom, prenoms),
      cloture_par_profile:profiles!tdrs_cloture_par_fkey(id, nom, prenoms),
      collaborateurs:tdr_collaborateurs(id, profile_id, permission, profile:profiles!tdr_collaborateurs_profile_id_fkey(id, nom, prenoms)),
      signataires:tdr_signataires(id, role, profile_id, ordre, statut, signe_le, commentaire, profile:profiles!tdr_signataires_profile_id_fkey(id, nom, prenoms))
    `)
    .eq('id', id)
    .single()

  if (!tdr) redirect('/tdr')

  const { data: allProfiles } = await supabase
    .from('profiles').select('id, nom, prenoms').eq('archived', false).order('prenoms')

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
      <TdrDetailClient tdr={tdr as any} myId={user.id} myRole={realRole} allProfiles={allProfiles ?? []} />
    </>
  )
}
