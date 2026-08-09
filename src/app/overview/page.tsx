export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import OverviewOperations from '@/components/OverviewOperations'
import AAFNav from '@/app/aaf/AAFNav'
import { estRH, estAAF } from '@/lib/roles'

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? ''
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()
  if (!['aaf','caf','de','dp','admin','administrateur','superadmin'].includes(role)) redirect('/timesheets')

  // L'AAF (seul) accède à Vue d'ensemble depuis le menu AAF — cette page est
  // hors de /aaf/*, donc sans la barre d'onglets alignée (AAFNav) par défaut :
  // on la réaffiche ici pour ne pas la faire disparaître en cours de
  // navigation. La CAF, elle, a désormais son propre menu CAF Pro distinct
  // (voir AppHeader) — lui montrer la barre AAF ici serait trompeur, comme
  // si ces onglets étaient un sous-menu de Vue d'ensemble.
  const showAAFNav = role === 'aaf' || ['admin', 'superadmin'].includes(role)

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
      <div className="page-container" style={{ display: 'grid', gap: 28 }}>

      {showAAFNav && <AAFNav role={role} />}

      <div>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Vue d'ensemble des opérations</h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          Tous les dossiers en cours et clôturés — timesheets, rapports mensuels, ordres de mission, demandes de paiement.
        </p>
      </div>

      <Suspense fallback={<p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>}>
        <OverviewOperations role={role} />
      </Suspense>
      </div>
    </>
  )
}
