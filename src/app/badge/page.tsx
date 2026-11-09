export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import MonEspaceNav from '@/components/MonEspaceNav'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF, estBD } from '@/lib/roles'
import { debutJourLocal } from '@/lib/badge-jours'
import BadgePointageClient from '@/components/BadgePointageClient'

const ACCES_HISTORIQUE_EQUIPE = ['manager', 'rh', 'caf', 'admin', 'superadmin']

export default async function BadgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, titre, type_emploi, avatar_url, photo_reference_badge_url').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  const { data: pointagesDuJour } = await supabase
    .from('badge_pointages')
    .select('id, type, statut, horodatage')
    .eq('profile_id', user.id)
    .neq('statut', 'non_badge')
    .gte('horodatage', debutJourLocal().toISOString())
    .order('horodatage', { ascending: true })

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        showBD={estBD(profile?.titre)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">
        <div className="section-with-sidenav">
          <MonEspaceNav typeEmploi={profile?.type_emploi} />
          <div className="section-content">
            <div className="page-container" style={{ maxWidth: 480, paddingLeft: 0, paddingRight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Badgeage</h2>
                {ACCES_HISTORIQUE_EQUIPE.includes(role) && (
                  <Link href="/badge/historique" style={{ fontSize: 12.5, color: 'var(--abed-green)', fontWeight: 600 }}>
                    Historique de l&apos;équipe →
                  </Link>
                )}
              </div>
              <BadgePointageClient
                aReferencePhoto={!!profile?.photo_reference_badge_url}
                pointagesDuJour={pointagesDuJour ?? []}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
