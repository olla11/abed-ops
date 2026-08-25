import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import BDNav from './BDNav'
import OverviewSubNav from '@/components/OverviewSubNav'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estBD } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// Superviseurs en lecture seule : les mêmes rôles qui voient l'onglet
// principal "Vue d'ensemble" (voir OVERVIEW_ROLES dans AppHeader) — BD n'a
// plus son propre menu pour eux, ils y accèdent désormais comme sous-onglet
// de Vue d'ensemble (voir OverviewSubNav).
const SUPERVISEUR_ROLES = ['de', 'dp', 'caf', 'admin', 'administrateur', 'superadmin']

export default async function BDLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const estEquipeBD = estBD(profile?.titre)
  const estSuperviseur = SUPERVISEUR_ROLES.includes(profile?.role ?? '')
  if (!profile || !(estEquipeBD || estSuperviseur)) redirect('/dashboard')

  const realRole = profile.role
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  return (
    <>
      <AppHeader
        userName={`${profile.prenoms ?? ''} ${profile.nom ?? ''}`}
        userRole={role}
        userTitre={profile.titre}
        typeEmploi={profile.type_emploi}
        showBD={estEquipeBD}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        avatarUrl={profile.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">
        {!estEquipeBD && (
          <>
            <div style={{ marginBottom: 20 }}>
              <OverviewSubNav />
            </div>
            <div className="card" style={{ borderLeft: '4px solid #1e40af', marginBottom: 20, fontSize: 13, color: '#374151' }}>
              🔒 Vue en lecture seule — la gestion des opportunités est réservée à l&apos;équipe Business Developer.
            </div>
          </>
        )}
        <BDNav estEquipeBD={estEquipeBD} />
        {children}
      </div>
    </>
  )
}
