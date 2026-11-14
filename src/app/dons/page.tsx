export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import MonEspaceNav from '@/components/MonEspaceNav'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { DonLibreForm, DonReconciliationBlock, type DonMission } from '@/components/DonAbedHeritage'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF, estBD } from '@/lib/roles'
import { NOM_CLUB } from '@/lib/dons'

const TYPE_LABELS: Record<DonMission['type'], string> = {
  libre: 'Don spontané',
  partenaire: 'Don à la réconciliation',
  abandon_credit: 'Renonciation au remboursement',
}
const STATUT_LABELS: Record<DonMission['statut'], { label: string; color: string; bg: string }> = {
  declare: { label: 'En attente de confirmation', color: '#92400e', bg: '#fef3c7' },
  confirme: { label: 'Confirmé', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Non confirmé', color: '#991b1b', bg: '#fee2e2' },
}

export default async function DonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, titre, type_emploi, avatar_url').eq('id', user.id).single()
  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()
  const estValideur = estAAF(role) || ['de', 'admin', 'superadmin'].includes(role)

  const { data: mesDons } = await supabase.from('dons')
    .select('id, type, montant, statut, created_at, mission:missions(reference)')
    .eq('profile_id', user.id).order('created_at', { ascending: false })

  // Dons MoMo (spontanés ou de réconciliation) en attente de vérification
  // de la capture — les renonciations au remboursement se confirment seules
  // à la clôture de la mission.
  const { data: aConfirmer } = estValideur
    ? await createAdminClient().from('dons')
      .select('id, type, pourcentage, base_montant, montant, capture_path, statut, created_at, donateur:profiles!dons_profile_id_fkey(nom, prenoms), mission:missions(reference)')
      .eq('statut', 'declare').neq('type', 'abandon_credit').order('created_at', { ascending: true })
    : { data: [] as any[] }

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
        showBD={estBD(profile?.titre)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">
        <div className="section-with-sidenav">
          <MonEspaceNav typeEmploi={profile?.type_emploi} />
          <div className="section-content">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>{NOM_CLUB}</h2>
              <Link href="/abed-heritage" style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600 }}>Tableau d&apos;honneur →</Link>
            </div>

            <div style={{ maxWidth: 620 }}>
              <DonLibreForm />
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Mes dons</h3>
              {(mesDons ?? []).length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>Aucun don pour l&apos;instant.</p>
              ) : (
                <div className="table-wrap">
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead>
                    <tbody>
                      {(mesDons ?? []).map(d => {
                        const s = STATUT_LABELS[d.statut as DonMission['statut']]
                        const ref = (d.mission as any)?.reference
                        return (
                          <tr key={d.id}>
                            <td>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                            <td>{TYPE_LABELS[d.type as DonMission['type']]}{ref ? ` — ${ref}` : ''}</td>
                            <td style={{ fontWeight: 600 }}>{Number(d.montant).toLocaleString('fr-FR')} F CFA</td>
                            <td><span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {estValideur && (
              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, marginBottom: 4 }}>Dons à confirmer ({(aConfirmer ?? []).length})</h3>
                <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 6px' }}>
                  Vérifiez chaque capture avec le relevé MoMo Pay ABED avant de confirmer.
                </p>
                {(aConfirmer ?? []).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '8px 0 0' }}>Rien à confirmer.</p>
                ) : (aConfirmer ?? []).map((d: any) => (
                  <DonReconciliationBlock
                    key={d.id}
                    don={d as DonMission}
                    peutTraiter
                    entete={`${d.donateur?.prenoms ?? ''} ${d.donateur?.nom ?? ''} — ${new Date(d.created_at).toLocaleDateString('fr-FR')}${d.mission?.reference ? ` — mission ${d.mission.reference}` : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
