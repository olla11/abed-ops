export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { Award, Trophy, Sprout, ShieldCheck, Users } from 'lucide-react'
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
import { NOM_CLUB, DISTINCTION_LABELS, classementAnnuel, type Distinction } from '@/lib/dons'

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

  const admin = createAdminClient()
  const annee = new Date().getFullYear()
  const classement = await classementAnnuel(admin, annee)
  const podiumIds = classement.filter(r => r.distinction).map(r => r.profileId)
  const { data: podiumProfils } = podiumIds.length
    ? await admin.from('profiles').select('id, nom, prenoms').in('id', podiumIds)
    : { data: [] as { id: string; nom: string; prenoms: string }[] }
  const nomParId = new Map((podiumProfils ?? []).map(p => [p.id, `${p.prenoms} ${p.nom}`]))
  const moi = classement.find(r => r.profileId === user.id)

  const { data: mesDons } = await supabase.from('dons')
    .select('id, type, montant, statut, created_at, mission:missions(reference)')
    .eq('profile_id', user.id).order('created_at', { ascending: false })

  // Dons MoMo (spontanés ou de réconciliation) en attente de vérification
  // de la capture — les renonciations au remboursement se confirment seules
  // à la clôture de la mission.
  const { data: aConfirmer } = estValideur
    ? await admin.from('dons')
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
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>{NOM_CLUB}</h2>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
                Donner à ABED, suivre vos dons et votre place au tableau d&apos;honneur.
              </p>
            </div>

            <style>{`
              .dons-grille { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start; }
              @media (max-width: 1000px) { .dons-grille { grid-template-columns: 1fr; } }
            `}</style>
            <div className="dons-grille">
              <DonLibreForm />

              <aside style={{ display: 'grid', gap: 16 }}>
                <div className="card" style={{
                  margin: 0, border: moi ? '1.5px solid #fbbf24' : '1.5px dashed #a7f3d0',
                  background: moi ? '#fffbeb' : '#f7fdf9',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--abed-muted)', marginBottom: 8 }}>
                    Votre statut
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: moi ? '#92400e' : '#065f46', marginBottom: 10 }}>
                    {moi
                      ? (moi.distinction ? `${moi.rang === 1 ? '1er' : `${moi.rang}e`} en ${annee}, distinction ${DISTINCTION_LABELS[moi.distinction]}` : `Membre ${NOM_CLUB} ${annee}`)
                      : 'Votre place vous attend'}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700, color: '#fde68a', background: '#065f46', border: '1px solid #fbbf24',
                  }}>
                    <Award size={13} /> {`${NOM_CLUB}${moi?.distinction ? ` · ${DISTINCTION_LABELS[moi.distinction]}` : ''}`}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 8 }}>
                    {moi ? 'Affichée à côté de votre nom sur l\'accueil.' : 'S\'affichera à côté de votre nom dès votre premier don confirmé.'}
                  </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 14 }}>
                      <Trophy size={17} color="#d97706" /> {`Podium ${annee}`}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--abed-muted)' }}>
                      <Users size={13} /> {`${classement.length} membre${classement.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(['or', 'argent', 'bronze'] as Distinction[]).map((d, i) => {
                      const r = classement.find(x => x.distinction === d)
                      const couleur = d === 'or' ? '#f59e0b' : d === 'argent' ? '#9ca3af' : '#ea580c'
                      return (
                        <div key={d} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
                          border: r ? `1px solid ${couleur}` : `1px dashed ${couleur}`, background: r ? 'white' : '#fafafa',
                        }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: '50%', background: couleur, color: 'white',
                            fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>{i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: r ? 700 : 500, color: r ? '#111827' : '#9ca3af', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r ? (nomParId.get(r.profileId) ?? '—') : 'Place libre — et si c\'était vous ?'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: couleur }}>{DISTINCTION_LABELS[d]}</span>
                        </div>
                      )
                    })}
                  </div>
                  <Link href="/abed-heritage" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, fontWeight: 700, color: 'var(--abed-green)' }}>
                    Voir le tableau d&apos;honneur →
                  </Link>
                </div>

                <div className="card" style={{ margin: 0, display: 'grid', gap: 12 }}>
                  {[
                    { Icon: Sprout, titre: 'Faire durer l\'action d\'ABED', texte: 'Votre don soutient directement les activités sur le terrain.' },
                    { Icon: Trophy, titre: 'Être reconnu', texte: 'Or, Argent et Bronze pour les trois plus grands donateurs de l\'année.' },
                    { Icon: ShieldCheck, titre: 'Discret', texte: 'Les montants ne sont jamais affichés, seul votre engagement l\'est.' },
                  ].map(({ Icon, titre, texte }) => (
                    <div key={titre} style={{ display: 'flex', gap: 10 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: '#ecfdf5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={17} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{titre}</div>
                        <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>{texte}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
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
