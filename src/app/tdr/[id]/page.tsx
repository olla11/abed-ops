export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import TdrDetailClient from './TdrDetailClient'
import { estRH } from '@/lib/roles'

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

  // Le RLS de `profiles` masque les autres personnes à qui n'a pas un rôle
  // privilégié (caf/de/dp/admin/manager/rh/superadmin) : pour un
  // collaborateur ou missionnaire consultant son propre TDR, les noms de
  // l'initiateur/responsable technique/autres collaborateurs/signataires
  // ressortent donc `null` du embed ci-dessus. On les complète depuis
  // l'annuaire (qui contourne cette restriction pour l'essentiel : nom,
  // prénoms, fonction).
  const idsReferences = new Set<string>()
  if (tdr.initiateur_id) idsReferences.add(tdr.initiateur_id)
  if (tdr.responsable_technique_id) idsReferences.add(tdr.responsable_technique_id)
  if (tdr.cloture_par) idsReferences.add(tdr.cloture_par)
  for (const c of tdr.collaborateurs ?? []) if (c.profile_id) idsReferences.add(c.profile_id)
  for (const s of tdr.signataires ?? []) if (s.profile_id) idsReferences.add(s.profile_id)

  if (idsReferences.size > 0) {
    const { data: annuaire } = await supabase
      .from('profiles_annuaire').select('id, nom, prenoms, fonction').in('id', [...idsReferences])
    const parId = new Map((annuaire ?? []).map(p => [p.id, p]))

    if (!tdr.initiateur && tdr.initiateur_id) tdr.initiateur = parId.get(tdr.initiateur_id) ?? null
    if (!tdr.responsable_technique && tdr.responsable_technique_id) tdr.responsable_technique = parId.get(tdr.responsable_technique_id) ?? null
    if (!tdr.cloture_par_profile && tdr.cloture_par) tdr.cloture_par_profile = parId.get(tdr.cloture_par) ?? null
    for (const c of tdr.collaborateurs ?? []) if (!c.profile && c.profile_id) c.profile = parId.get(c.profile_id) ?? null
    for (const s of tdr.signataires ?? []) if (!s.profile && s.profile_id) s.profile = parId.get(s.profile_id) ?? null
  }

  const { data: allProfiles } = await supabase
    .from('profiles_annuaire').select('id, nom, prenoms').eq('archived', false).order('prenoms')

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
      <TdrDetailClient tdr={tdr as any} myId={user.id} myRole={realRole} allProfiles={allProfiles ?? []} />
    </>
  )
}
