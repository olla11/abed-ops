export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import TdrListClient from './TdrListClient'
import { estRH, estAAF } from '@/lib/roles'

export type TdrLite = {
  id: string
  numero: string | null
  titre_activite: string
  projet: string | null
  periode: string | null
  statut: string
  initiateur_id: string
  initiateur: { id: string; nom: string; prenoms: string } | null
  created_at: string
  updated_at: string
  archive_le: string | null
  importe_historique: boolean
  signataires: { role: string; profile_id: string | null; statut: string }[]
  collaborateurs: { profile_id: string }[]
}

export default async function TdrPage() {
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
  const impersonation = await getImpersonationInfo()

  // RLS (tdrs_select / can_access_tdr) filtre déjà : initiateur, collaborateur,
  // signataire, ou rôle à vision globale (de/aaf/caf/dp/administrateur/admin) —
  // les autres rôles ne reçoivent ici que les TDR où ils sont impliqués.
  // Tri : les TDR créés dans le système d'abord (importe_historique=false),
  // puis les plus récents en tête dans chaque groupe ; numero en tie-break
  // pour les TDR importés en lot (même created_at à la microseconde près).
  const { data: tdrs, error } = await supabase
    .from('tdrs')
    .select(`id, numero, titre_activite, projet, periode, statut, initiateur_id, created_at, updated_at, archive_le, importe_historique,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms),
      signataires:tdr_signataires(role, profile_id, statut),
      collaborateurs:tdr_collaborateurs(profile_id)
    `)
    .order('importe_historique', { ascending: true })
    .order('created_at', { ascending: false })
    .order('numero', { ascending: false })

  if (error) console.error('[tdr/page] fetch error:', error)

  // Le RLS de `profiles` masque les autres personnes pour un rôle sans vision
  // globale : le nom du responsable (initiateur) ressort alors `null` du
  // embed ci-dessus. On le complète depuis l'annuaire (contourne cette
  // restriction pour l'essentiel : nom/prénoms), comme sur la fiche TDR.
  const idsInitiateurs = [...new Set((tdrs ?? []).filter(t => !t.initiateur && t.initiateur_id).map(t => t.initiateur_id))]
  if (idsInitiateurs.length > 0) {
    const { data: annuaire } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').in('id', idsInitiateurs)
    const parId = new Map((annuaire ?? []).map(p => [p.id, p]))
    for (const t of tdrs ?? []) if (!t.initiateur && t.initiateur_id) (t as any).initiateur = parId.get(t.initiateur_id) ?? null
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <TdrListClient tdrs={(tdrs ?? []) as any as TdrLite[]} myId={user.id} myRole={role} />
    </>
  )
}
