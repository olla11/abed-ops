export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ReconciliationForm from '@/components/ReconciliationForm'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import Link from 'next/link'
import { estAAF } from '@/lib/roles'

export default async function ReconciliationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mission } = await supabase
    .from('missions')
    .select('id, objet, lieu, status, missionnaire_id, a_charge_partenaire, reconciliation_commentaire')
    .eq('id', id)
    .single()

  if (!mission) redirect('/dashboard')
  if (mission.missionnaire_id !== user.id) redirect('/dashboard')

  // Autoriser la soumission et la resoumission après rejet CAF
  if (!['signe', 'en_mission', 'reconciliation'].includes(mission.status)) {
    redirect(`/missions/${id}`)
  }

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms').eq('id', user.id).single()

  const realRole = profile?.role ?? ''
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showAAF={estAAF(role)}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={`/missions/${id}`} style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Réconciliation</h2>
      </div>
      <p style={{ color: 'var(--abed-muted)', marginBottom: 24 }}>
        Mission : <strong>{mission.objet}</strong> — {mission.lieu}
        {mission.a_charge_partenaire && (
          <span style={{ marginLeft: 10, color: 'var(--abed-amber)' }}>
            ⚠ Mission à charge partenaire — prélèvement 20 % applicable
          </span>
        )}
      </p>
      <ReconciliationForm
        missionId={mission.id}
        aChargePartenaire={mission.a_charge_partenaire}
        commentaireRejet={mission.reconciliation_commentaire}
      />
    </div>
    </>
  )
}
