export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF } from '@/lib/roles'
import TdrTableauDeBordClient, { type TdrDashboardRow, type FactureDashboardRow } from './TdrTableauDeBordClient'

// Statuts couverts par le suivi financier — mêmes que l'onglet "Tous les TdR
// actifs" de la liste : un TdR en brouillon ou en cours de pré-autorisation
// n'a pas encore de budget figé, il n'a rien à faire dans ce tableau de bord.
const STATUTS_SUIVI_FINANCIER = ['actif', 'reconciliation_caf', 'reconciliation_responsable', 'cloture']

export default async function TdrTableauDeBordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  if (!['aaf', 'caf', 'de', 'admin', 'superadmin'].includes(realRole)) redirect('/tdr')

  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  // RLS (tdrs_select / can_access_tdr) accorde déjà une vision globale à
  // de/aaf/caf/administrateur/admin — pas besoin du client admin ici.
  const { data } = await supabase
    .from('tdrs')
    .select(`id, numero, titre_activite, statut, projet, budget_total_valide, montant_depense,
      execution_statut, initiateur_id, date_debut_prevue,
      initiateur:profiles!tdrs_initiateur_id_fkey(nom, prenoms)`)
    .in('statut', STATUTS_SUIVI_FINANCIER)
    .is('archive_le', null)
  const tdrs = (data ?? []) as unknown as TdrDashboardRow[]

  // Le RLS de `profiles` masque les autres personnes pour un rôle sans vision
  // globale : le nom du responsable (initiateur) ressort alors `null` du
  // embed ci-dessus. On le complète depuis l'annuaire, comme sur la liste et
  // la fiche TdR.
  const idsInitiateurs = [...new Set(tdrs.filter(t => !t.initiateur && t.initiateur_id).map(t => t.initiateur_id))]
  if (idsInitiateurs.length > 0) {
    const { data: annuaire } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').in('id', idsInitiateurs)
    const parId = new Map((annuaire ?? []).map(p => [p.id, p]))
    for (const t of tdrs) if (!t.initiateur && t.initiateur_id) t.initiateur = parId.get(t.initiateur_id) ?? null
  }

  const idsTdrs = tdrs.map(t => t.id)
  const { data: facturesData } = idsTdrs.length > 0
    ? await supabase.from('tdr_factures').select('tdr_id, montant, date_facture').in('tdr_id', idsTdrs)
    : { data: [] as FactureDashboardRow[] }
  const factures = (facturesData ?? []) as FactureDashboardRow[]

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

      <TdrTableauDeBordClient tdrs={tdrs} factures={factures} />
    </>
  )
}
