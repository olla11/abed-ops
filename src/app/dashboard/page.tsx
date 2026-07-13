export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import MissionsTable from './MissionsTable'

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
  const isManager = ['admin', 'rh', 'caf', 'de', 'dp', 'administrateur'].includes(role)
  const isSignataire = ['caf', 'de', 'dp', 'admin', 'administrateur'].includes(role)

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
    reconciliation_caf: 'Validation CAF',
    paiement_attente: 'Paiement en attente',
    cloture: 'Clôturé',
    rejete: 'Rejeté',
  }

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
      <div className="page-container">

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSignataire ? 4 : 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Ordres de mission</h3>
            {isSignataire && (
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '3px 0 0' }}>
                Gérez vos missions et signez celles qui vous sont soumises.
              </p>
            )}
          </div>
          <Link href="/missions/nouveau" className="btn" style={{ fontSize: 13 }}>+ Nouvel OM</Link>
        </div>
        <MissionsTable
          missions={(missions ?? []) as any}
          isManager={isManager}
          isSignataire={isSignataire}
          userId={user.id}
        />
      </div>
      </div>
    </>
  )
}
