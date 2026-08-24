export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import MissionsTable from './MissionsTable'
import { estRH, estAAF, estBD } from '@/lib/roles'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.must_change_password) redirect('/auth/changer-mot-de-passe')

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()
  const isManager = ['admin', 'rh', 'caf', 'de', 'dp', 'administrateur'].includes(role)
  // Signer un OM depuis ce tableau reste possible pour CAF/DP/admin — le DE a
  // désormais son propre menu dédié (/de/om-a-signer), même logique que
  // showReconciliationTabs pour AAF/CAF juste en dessous.
  const isSignataire = ['caf', 'dp', 'admin', 'administrateur'].includes(role)
  // AAF et CAF traitent désormais les réconciliations depuis leur menu AAF
  // dédié (/aaf/reconciliations) — le tableau de bord personnel ne montre
  // plus cet onglet de traitement pour eux, seulement pour l'admin.
  const showReconciliationTabs = role === 'admin'
  const canValidateReconc = role === 'admin'
  // Idem : autorisation finale DE désormais dans /de/reconciliations.
  const canAutoriserDE = role === 'admin'

  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
    .order('created_at', { ascending: false })

  const STATUS_LABELS: Record<string, string> = {
    brouillon: 'Brouillon',
    soumis: 'Soumis',
    signe: 'Signé',
    en_mission: 'En mission',
    reconciliation: 'Réconciliation',
    reconciliation_aaf: 'Validation AAF',
    reconciliation_caf: 'Validation CAF',
    reconciliation_de: 'Autorisation DE',
    paiement_attente: 'Paiement en attente',
    cloture: 'Clôturé',
    rejete: 'Rejeté',
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        showBD={estBD(profile?.titre) || role === 'de'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (isSignataire || showReconciliationTabs) ? 4 : 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Ordres de mission</h3>
            {isSignataire && (
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '3px 0 0' }}>
                Gérez vos missions et signez celles qui vous sont soumises.
              </p>
            )}
            {showReconciliationTabs && (
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '3px 0 0' }}>
                Gérez vos missions et validez les réconciliations qui vous sont soumises.
              </p>
            )}
          </div>
          <Link href="/missions/nouveau" className="btn" style={{ fontSize: 13 }}>+ Nouvel OM</Link>
        </div>
        <MissionsTable
          missions={(missions ?? []) as any}
          isManager={isManager}
          isSignataire={isSignataire}
          isAAF={showReconciliationTabs}
          canValidateReconc={canValidateReconc}
          canAutoriserDE={canAutoriserDE}
          userId={user.id}
        />
      </div>
      </div>
    </>
  )
}
