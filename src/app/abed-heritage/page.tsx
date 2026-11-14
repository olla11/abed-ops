export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Award } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF, estBD } from '@/lib/roles'
import { classementAnnuel, DISTINCTION_LABELS, NOM_CLUB, MOMO_PAY_ABED, type Distinction } from '@/lib/dons'

const MEDAILLES: Record<Distinction, { couleur: string; fond: string; bordure: string }> = {
  or: { couleur: '#92400e', fond: 'linear-gradient(135deg, #fef3c7, #fde68a)', bordure: '#f59e0b' },
  argent: { couleur: '#374151', fond: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)', bordure: '#9ca3af' },
  bronze: { couleur: '#7c2d12', fond: 'linear-gradient(135deg, #ffedd5, #fed7aa)', bordure: '#ea580c' },
}

export default async function AbedHeritagePage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, titre, type_emploi, avatar_url').eq('id', user.id).single()
  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  const anneeCourante = new Date().getFullYear()
  const { annee: anneeParam } = await searchParams
  const annee = Number(anneeParam) >= 2020 && Number(anneeParam) <= anneeCourante ? Number(anneeParam) : anneeCourante

  const admin = createAdminClient()
  const classement = await classementAnnuel(admin, annee)

  const { data: premierDon } = await admin.from('dons').select('created_at')
    .eq('statut', 'confirme').order('created_at', { ascending: true }).limit(1).maybeSingle()
  const premiereAnnee = premierDon ? new Date(premierDon.created_at).getFullYear() : anneeCourante
  const annees = Array.from({ length: anneeCourante - premiereAnnee + 1 }, (_, i) => anneeCourante - i)

  const ids = classement.map(r => r.profileId)
  const { data: personnes } = ids.length
    ? await admin.from('profiles').select('id, nom, prenoms, fonction').in('id', ids)
    : { data: [] as { id: string; nom: string; prenoms: string; fonction: string | null }[] }
  const parId = new Map((personnes ?? []).map(p => [p.id, p]))

  const podium = classement.filter(r => r.distinction)
  const membres = classement.filter(r => !r.distinction)
  const moi = classement.find(r => r.profileId === user.id)

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
      <main className="page-container" style={{ maxWidth: 880 }}>
        <div className="hero-accueil" style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
          borderRadius: 20, padding: '32px 36px', marginBottom: 24, color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Award size={26} />
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'white' }}>{NOM_CLUB}</h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 620 }}>
            Le cercle de celles et ceux qui soutiennent ABED par un don, à l&apos;issue d&apos;une mission financée par un partenaire
            ou en renonçant à tout ou partie d&apos;un remboursement. Merci à chacun d&apos;eux.
          </p>
          {moi && (
            <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: '#a7f3d0' }}>
              ✓ Vous faites partie d&apos;{NOM_CLUB} en {annee}{moi.distinction ? ` — distinction ${DISTINCTION_LABELS[moi.distinction]}` : ''}.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>Tableau d&apos;honneur {annee}</h2>
          {annees.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {annees.map(a => (
                <Link key={a} href={`/abed-heritage?annee=${a}`} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
                  border: `1px solid ${a === annee ? 'var(--abed-green)' : 'var(--abed-border)'}`,
                  background: a === annee ? 'var(--abed-green)' : 'white',
                  color: a === annee ? 'white' : '#374151',
                }}>{a}</Link>
              ))}
            </div>
          )}
        </div>

        {classement.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--abed-muted)', fontSize: 14, padding: '36px 24px' }}>
            Aucun don confirmé en {annee} pour l&apos;instant. Le premier donateur de l&apos;année décrochera la distinction Or !
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              {podium.map(r => {
                const p = parId.get(r.profileId)
                const m = MEDAILLES[r.distinction!]
                return (
                  <div key={r.profileId} style={{ background: m.fond, border: `1.5px solid ${m.bordure}`, borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: m.couleur, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Award size={15} /> {r.rang}{r.rang === 1 ? 'er' : 'e'} — {DISTINCTION_LABELS[r.distinction!]}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 8 }}>
                      {p ? `${p.prenoms} ${p.nom}` : '—'}
                    </div>
                    {p?.fonction && <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 2 }}>{p.fonction}</div>}
                  </div>
                )
              })}
            </div>

            {membres.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>Membres {NOM_CLUB} {annee}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {membres.map(r => {
                    const p = parId.get(r.profileId)
                    return (
                      <span key={r.profileId} style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                        background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46',
                      }}>
                        {p ? `${p.prenoms} ${p.nom}` : '—'}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginTop: 20 }}>
          Les dons se font à la réconciliation de votre mission (MoMo Pay ABED : <strong>{MOMO_PAY_ABED}</strong>).
          Seuls les dons confirmés sont pris en compte ; les montants ne sont jamais affichés.
        </p>
      </main>
    </>
  )
}
