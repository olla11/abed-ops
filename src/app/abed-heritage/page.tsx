export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Award, HeartHandshake, Smartphone, Trophy, Sprout, ShieldCheck, Users } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { DonLibreForm } from '@/components/DonAbedHeritage'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF, estBD } from '@/lib/roles'
import { classementAnnuel, DISTINCTION_LABELS, NOM_CLUB, MOMO_PAY_ABED, type Distinction, type RangDonateur } from '@/lib/dons'

const MEDAILLES: Record<Distinction, { couleur: string; fond: string; bordure: string; hauteur: number }> = {
  or: { couleur: '#92400e', fond: 'linear-gradient(160deg, #fef3c7, #fcd34d)', bordure: '#f59e0b', hauteur: 150 },
  argent: { couleur: '#374151', fond: 'linear-gradient(160deg, #f9fafb, #d1d5db)', bordure: '#9ca3af', hauteur: 120 },
  bronze: { couleur: '#7c2d12', fond: 'linear-gradient(160deg, #ffedd5, #fdba74)', bordure: '#ea580c', hauteur: 100 },
}
// Ordre classique d'un podium : 2e à gauche, 1er au centre, 3e à droite.
const ORDRE_PODIUM: Distinction[] = ['argent', 'or', 'bronze']

function initiales(prenoms?: string | null, nom?: string | null) {
  return `${(prenoms ?? '').trim().charAt(0)}${(nom ?? '').trim().charAt(0)}`.toUpperCase() || '?'
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
  const estAnneeCourante = annee === anneeCourante

  const admin = createAdminClient()
  const [classement, { data: premierDon }, { data: dernierDon }, { count: mesDonsConfirmes }] = await Promise.all([
    classementAnnuel(admin, annee),
    admin.from('dons').select('created_at').eq('statut', 'confirme').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    admin.from('dons').select('profile_id').eq('statut', 'confirme').order('traite_le', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('dons').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('statut', 'confirme'),
  ])
  const premiereAnnee = premierDon ? new Date(premierDon.created_at).getFullYear() : anneeCourante
  const annees = Array.from({ length: anneeCourante - premiereAnnee + 1 }, (_, i) => anneeCourante - i)

  const ids = [...new Set([...classement.map(r => r.profileId), ...(dernierDon ? [dernierDon.profile_id] : [])])]
  const { data: personnes } = ids.length
    ? await admin.from('profiles').select('id, nom, prenoms, fonction').in('id', ids)
    : { data: [] as { id: string; nom: string; prenoms: string; fonction: string | null }[] }
  const parId = new Map((personnes ?? []).map(p => [p.id, p]))

  const parDistinction = new Map(classement.filter(r => r.distinction).map(r => [r.distinction!, r]))
  const membres = classement.filter(r => !r.distinction)
  const moi = classement.find(r => r.profileId === user.id)
  const estMembre = (mesDonsConfirmes ?? 0) > 0
  const dernierMembre = dernierDon ? parId.get(dernierDon.profile_id) : null
  const placesLibres = ORDRE_PODIUM.filter(d => !parDistinction.has(d)).length

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
      <style>{`
        .heritage-podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: end; }
        .heritage-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .heritage-cta { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 12px; font-weight: 800; font-size: 14.5px; text-decoration: none; background: #fbbf24; color: #422006; box-shadow: 0 6px 20px rgba(251,191,36,.35); }
        .heritage-cta:hover { background: #f59e0b; }
        @media (max-width: 700px) {
          .heritage-podium, .heritage-3col { grid-template-columns: 1fr; }
          .heritage-podium .podium-or { order: -1; }
        }
      `}</style>
      <main className="page-container" style={{ maxWidth: 920 }}>

        {/* ── Hero ── */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 55%, #047857 100%)',
          borderRadius: 20, padding: '34px 36px', marginBottom: 26, color: 'white', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(251,191,36,0.10)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Award size={28} color="#fcd34d" />
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: 'white' }}>{NOM_CLUB}</h1>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#fde68a' }}>
              Ce que nous construisons ensemble nous survit.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.82)', maxWidth: 640, lineHeight: 1.6 }}>
              {`${NOM_CLUB} réunit celles et ceux qui donnent à ABED pour faire durer son action : l'agriculture, le bien-être et le développement durable. Chaque don, même modeste, vous inscrit dans cette histoire, et chaque année les plus engagés sont distingués au tableau d'honneur.`}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {estAnneeCourante && (
                <a href="#don" className="heritage-cta">
                  <HeartHandshake size={18} /> {estMembre ? 'Faire un nouveau don' : `Rejoindre ${NOM_CLUB}`}
                </a>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                <Users size={15} /> {`${classement.length} membre${classement.length > 1 ? 's' : ''} en ${annee}`}
              </span>
              {estAnneeCourante && dernierMembre && (
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {`· Dernier donateur : ${dernierMembre.prenoms} ${(dernierMembre.nom ?? '').charAt(0)}.`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Statut personnel ── */}
        {estAnneeCourante && (
          <div className="card" style={{
            marginBottom: 26, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            border: estMembre ? '1.5px solid #fbbf24' : '1.5px dashed #a7f3d0', background: estMembre ? '#fffbeb' : '#f7fdf9',
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              {estMembre ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>
                    {moi?.distinction
                      ? `Vous êtes ${moi.rang === 1 ? '1er' : `${moi.rang}e`} en ${annee}, distinction ${DISTINCTION_LABELS[moi.distinction]}. Bravo !`
                      : `Merci, vous faites partie d'${NOM_CLUB}.`}
                  </div>
                  <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
                    {moi?.distinction
                      ? 'Votre place est en jeu jusqu\'au 31 décembre.'
                      : `${placesLibres > 0 ? 'Il reste encore une place sur le podium cette année.' : 'Un nouveau don peut vous faire monter sur le podium.'}`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#065f46' }}>Votre place vous attend.</div>
                  <div style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>
                    Dès votre premier don confirmé, cette distinction s&apos;affiche à côté de votre nom sur votre page d&apos;accueil :
                  </div>
                </>
              )}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20,
              fontSize: 12.5, fontWeight: 700, color: '#fde68a', background: '#065f46', border: '1px solid #fbbf24',
              opacity: estMembre ? 1 : 0.9,
            }}>
              <Award size={14} /> {`${NOM_CLUB}${moi?.distinction ? ` · ${DISTINCTION_LABELS[moi.distinction]}` : ''}`}
            </span>
          </div>
        )}

        {/* ── Tableau d'honneur ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--abed-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} /> {`Tableau d'honneur ${annee}`}
          </h2>
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

        <div className="heritage-podium" style={{ marginBottom: 18 }}>
          {ORDRE_PODIUM.map(d => (
            <PlacePodium key={d} distinction={d} rang={parDistinction.get(d)} parId={parId} ouverte={estAnneeCourante} />
          ))}
        </div>

        {membres.length > 0 && (
          <div className="card" style={{ marginBottom: 26 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>{`Membres ${NOM_CLUB} ${annee}`}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {membres.map(r => {
                const p = parId.get(r.profileId)
                return (
                  <span key={r.profileId} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '5px 12px 5px 5px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46',
                  }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#065f46', color: 'white', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {initiales(p?.prenoms, p?.nom)}
                    </span>
                    {p ? `${p.prenoms} ${p.nom}` : '—'}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Pourquoi donner ── */}
        <h2 style={{ margin: '8px 0 14px', color: 'var(--abed-green)' }}>Pourquoi donner ?</h2>
        <div className="heritage-3col" style={{ marginBottom: 26 }}>
          <Raison Icon={Sprout} titre="Faire durer l'action de ABED"
            texte="Votre don soutient directement les activités de ABED sur le terrain, au-delà des financements des partenaires." />
          <Raison Icon={Trophy} titre="Être reconnu"
            texte="Chaque année, les trois plus grands donateurs reçoivent les distinctions Or, Argent et Bronze, et tous les membres figurent au tableau d'honneur." />
          <Raison Icon={ShieldCheck} titre="Discret et simple"
            texte="Un code MoMo à composer, une capture à joindre : une minute. Les montants ne sont jamais affichés, seul votre engagement l'est." />
        </div>

        {/* ── Faire un don ── */}
        {estAnneeCourante && (
          <div id="don" style={{ scrollMarginTop: 90, marginBottom: 26 }}>
            <h2 style={{ margin: '0 0 14px', color: 'var(--abed-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={22} /> Faire un don maintenant
            </h2>
            <DonLibreForm />
          </div>
        )}

        {/* ── Comment ça marche ── */}
        <div className="card" style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Trois façons de donner</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><strong>Don spontané</strong> : à tout moment, ici ou depuis <Link href="/dons" style={{ color: 'var(--abed-green)', fontWeight: 600 }}>Mon espace → ABED Héritage</Link>, du montant de votre choix.</li>
            <li><strong>À la réconciliation d&apos;une mission financée par un partenaire</strong> : le pourcentage de votre choix du montant reçu.</li>
            <li><strong>Mission à crédit</strong> : en renonçant à tout ou partie du remboursement que ABED vous doit, sans rien verser.</li>
          </ul>
          <p style={{ margin: '10px 0 0', color: 'var(--abed-muted)', fontSize: 12.5 }}>
            {`MoMo Pay ABED : ${MOMO_PAY_ABED}. Un don compte une fois le paiement vérifié par l'AAF ou la CAF. Le classement se fait sur le total de l'année ; les montants ne sont jamais affichés.`}
          </p>
        </div>
      </main>
    </>
  )
}

function PlacePodium({ distinction, rang, parId, ouverte }: {
  distinction: Distinction
  rang: RangDonateur | undefined
  parId: Map<string, { nom: string; prenoms: string; fonction: string | null }>
  ouverte: boolean
}) {
  const classe = distinction === 'or' ? 'podium-or' : undefined
  const m = MEDAILLES[distinction]
  const p = rang ? parId.get(rang.profileId) : null
  const position = distinction === 'or' ? '1er' : distinction === 'argent' ? '2e' : '3e'

  if (!p) {
    return (
      <div className={classe} style={{
        minHeight: m.hauteur, borderRadius: 14, padding: '16px 18px',
        border: `2px dashed ${m.bordure}`, background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: m.couleur }}>
          {`${position} — ${DISTINCTION_LABELS[distinction]}`}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '6px 0 4px' }}>Place libre</div>
        {ouverte && (
          <a href="#don" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--abed-green)' }}>Et si c&apos;était vous ? →</a>
        )}
      </div>
    )
  }

  return (
    <div className={classe} style={{
      minHeight: m.hauteur, borderRadius: 14, padding: '16px 18px',
      background: m.fond, border: `1.5px solid ${m.bordure}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      boxShadow: distinction === 'or' ? '0 10px 28px rgba(245,158,11,.25)' : 'none',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: m.couleur, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Award size={15} /> {`${position} — ${DISTINCTION_LABELS[distinction]}`}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 8 }}>{`${p.prenoms} ${p.nom}`}</div>
      {p.fonction && <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 2 }}>{p.fonction}</div>}
    </div>
  )
}

function Raison({ Icon, titre, texte }: { Icon: typeof Award; titre: string; texte: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ecfdf5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={20} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{titre}</div>
      <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.55 }}>{texte}</div>
    </div>
  )
}
