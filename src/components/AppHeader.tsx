'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import UserAvatar from './UserAvatar'
import AgaWidget from './AgaWidget'
import NotificationBell from './NotificationBell'
import { estAAF as roleEstAAF, estRH as roleEstRH, estCAF as roleEstCAF, estDE as roleEstDE, estBD as titreEstBD } from '@/lib/roles'

type Props = {
  userName?: string
  userRole?: string
  userTitre?: string | null
  typeEmploi?: string | null
  showAdmin?: boolean
  showRH?: boolean
  showAAF?: boolean
  showCAF?: boolean
  showDE?: boolean
  showBD?: boolean
  avatarUrl?: string | null
}

// Vue d'ensemble reste un onglet principal pour la CAF (elle garde son accès
// direct) et pour de/dp/admin — pour AAF (seul), elle est transposée en
// premier sous-menu du menu "AAF" (voir aafTabs ci-dessous) plutôt que
// dupliquée aux deux endroits.
const OVERVIEW_ROLES = ['de','dp','caf','admin','administrateur','superadmin']
const RAPPORT_TYPES = ['benevole','stagiaire_n1','stagiaire_n2','cdd','cdi']

export default function AppHeader({ userName, userRole, userTitre, typeEmploi, showAdmin, showRH, showAAF, showCAF, showDE, showBD, avatarUrl }: Props) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')
  // Repli calculé directement depuis le rôle effectif si l'appelant n'a pas
  // fourni la prop explicitement — évite la classe de bug déjà rencontrée
  // avec showAAF (des pages qui oubliaient de la passer perdaient le menu).
  const effectiveShowAAF = showAAF ?? roleEstAAF(userRole)
  const effectiveShowRH = showRH ?? roleEstRH(userRole)
  // Le menu CAF (déroulant CAF Pro / AAF / RH) remplace les onglets AAF et RH
  // séparés pour la CAF — exclusif à ce rôle, pas de repli par défaut ailleurs.
  const effectiveShowCAF = showCAF ?? roleEstCAF(userRole)
  // DE : rôle autonome comme AAF seul (pas d'héritage) — lien simple, pas de
  // menu déroulant (voir commentaire près du lien AAF plus bas).
  const effectiveShowDE = showDE ?? roleEstDE(userRole)
  // BD : contrairement à AAF/CAF/DE, ce n'est pas un rôle d'accès dédié (le
  // titre business_developer partage l'AccessRole 'manager' avec d'autres
  // postes) — le repli se fait donc sur le TITRE, pas sur userRole.
  const effectiveShowBD = showBD ?? titreEstBD(userTitre)
  const [dossierOpen, setDossierOpen] = useState(false)
  // Quel sous-groupe (par son label) affiche son survol flottant — plusieurs
  // groupes peuvent coexister dans "Mon espace" (Doc & Sign, Contrats & Évaluations...).
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [cafOpen, setCafOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileRef = useRef<HTMLDivElement>(null)

  // "Documents" et "Signature directe" étaient un seul lien ambigu (deux
  // pages différentes derrière le même mot) — désormais un sous-menu "Doc &
  // Sign" avec une entrée par page, chacune n'affichant plus que la sienne.
  const docSignTabs = [
    { href: '/signatures', label: 'Signature directe', match: ['/signatures'] },
    { href: '/documents', label: 'Documents', match: ['/documents'] },
  ]

  // "Contrats" était un lien isolé — /evaluations existe mais n'était relié
  // à aucun menu (seulement atteignable via le lien d'une notification), ce
  // qui le rendait invisible. Un contrat/convention et l'évaluation qui en
  // découle en fin de période sont le même dossier RH pour la personne
  // évaluée — d'où un sous-menu commun plutôt que deux entrées séparées.
  const contratsEvalTabs = [
    { href: '/mes-contrats', label: t('contracts'), match: ['/mes-contrats'] },
    { href: '/evaluations', label: t('evaluations'), match: ['/evaluations'] },
  ]

  type SubTab =
    | { kind: 'link'; href: string; label: string; match: string[] }
    | { kind: 'group'; label: string; match: string[]; children: typeof docSignTabs }

  const subTabs: SubTab[] = [
    { kind: 'link', href: '/dashboard', label: t('missions'), match: ['/dashboard', '/missions'] },
    { kind: 'link', href: '/timesheets', label: estRapport ? t('monthlyReport') : t('timesheets'), match: ['/timesheets'] },
    { kind: 'link', href: '/demandes', label: t('payments'), match: ['/demandes'] },
    { kind: 'link', href: '/conges', label: t('leaves'), match: ['/conges'] },
    { kind: 'group', label: 'Doc & Sign', match: ['/documents', '/signatures'], children: docSignTabs },
    { kind: 'group', label: t('contractsGroup'), match: ['/mes-contrats', '/evaluations'], children: contratsEvalTabs },
  ]

  // Appellations volontairement différentes de "Mon espace" (verbe d'action en
  // tête) : ce menu sert à traiter les dossiers d'autrui, pas à consulter les
  // siens — la distinction doit se voir dans le libellé, pas seulement dans le lien.
  const aafTabs = [
    { href: '/overview', label: "Vue d'ensemble", match: ['/overview'] },
    { href: '/aaf/demandes-paiement', label: 'Traiter les demandes de paiement', match: ['/aaf/demandes-paiement'] },
    { href: '/aaf/rapports-allocations', label: "Traiter les rapports d'allocation", match: ['/aaf/rapports-allocations'] },
    { href: '/aaf/reconciliations', label: 'Valider les réconciliations OM', match: ['/aaf/reconciliations'] },
  ]

  // Menu CAF : regroupe l'espace de traitement propre à la CAF (CAF Pro) et
  // les deux menus déjà accessibles par héritage (AAF, RH) — un seul point
  // d'entrée au lieu de 3 onglets séparés. Vue d'ensemble reste HORS de ce
  // menu, en onglet principal indépendant (cf. OVERVIEW_ROLES).
  const cafTabs = [
    { href: '/caf', label: 'CAF Pro', match: ['/caf'] },
    { href: '/aaf', label: 'AAF', match: ['/aaf'] },
    { href: '/rh', label: 'RH', match: ['/rh'] },
  ]

  const mainTabs = [
    { href: '/statut', label: t('status'), match: ['/statut'] },
    { href: '/projets', label: t('projects'), match: ['/projets'] },
    { href: '/tdr', label: t('tdr'), match: ['/tdr'] },
    { href: '/ressources', label: t('resources'), match: ['/ressources'] },
    ...(showOverview ? [{ href: '/overview', label: t('overview'), match: ['/overview'] }] : []),
    // RH : masqué ici quand le menu CAF est actif, il y figure déjà en sous-entrée.
    ...(effectiveShowRH && !effectiveShowCAF ? [{ href: '/rh', label: t('rh'), match: ['/rh'] }] : []),
    ...(showAdmin ? [{ href: '/admin', label: t('admin'), match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  const dossierActive = subTabs.some(s => isActive(s.match))
  const aafActive = effectiveShowAAF && (isActive(['/aaf']) || aafTabs.some(s => isActive(s.match)))
  const cafActive = effectiveShowCAF && cafTabs.some(s => isActive(s.match))
  const deActive = effectiveShowDE && isActive(['/de'])
  const bdActive = effectiveShowBD && isActive(['/bd'])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return
    function handle(e: MouseEvent) {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [mobileOpen])

  return (
    <>
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: 'white',
      borderBottom: '1px solid var(--abed-border)',
      boxShadow: '0 1px 8px rgba(0,0,0,.06)',
    }}>
      <div className="page-container" style={{
        paddingTop: 0, paddingBottom: 0,
        display: 'flex', alignItems: 'center',
        height: 60, gap: 8,
      }}>

        {/* Logo */}
        <Link href="/accueil" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0, marginRight: 8 }}>
          <Image src="/logoabed2.png" alt="Logo ABED" width={34} height={34} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--abed-green)', letterSpacing: 0.5 }}>My ABED</span>
        </Link>

        {/* Onglets desktop */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'stretch', flex: 1, height: '100%', gap: 2 }}>

          {/* Mon espace (dropdown) */}
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
            onMouseEnter={() => setDossierOpen(true)}
            onMouseLeave={() => setDossierOpen(false)}
          >
            <button style={tabStyle(dossierActive)}>
              {t('dossier')} <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>▼</span>
            </button>
            {dossierOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 200,
                background: 'white', border: '1px solid var(--abed-border)',
                borderRadius: '0 0 10px 10px', minWidth: 230,
                boxShadow: '0 8px 24px rgba(0,0,0,.10)',
              }}>
                {subTabs.map(s => {
                  const active = isActive(s.match)
                  if (s.kind === 'group') {
                    return (
                      <div key={s.label}
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setOpenGroup(s.label)}
                        onMouseLeave={() => setOpenGroup(null)}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 18px', fontSize: 13,
                          fontWeight: active ? 700 : 400,
                          color: active ? 'var(--abed-green)' : '#374151',
                          background: active ? '#f0fdf4' : 'white',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'default',
                        }}>
                          {s.label} <span style={{ fontSize: 9, opacity: 0.7 }}>▶</span>
                        </div>
                        {openGroup === s.label && (
                          <div style={{
                            position: 'absolute', top: 0, left: '100%', zIndex: 201,
                            background: 'white', border: '1px solid var(--abed-border)',
                            borderRadius: 10, minWidth: 190,
                            boxShadow: '0 8px 24px rgba(0,0,0,.10)',
                          }}>
                            {s.children.map(c => {
                              const childActive = isActive(c.match)
                              return (
                                <Link key={c.href} href={c.href}
                                  style={{
                                    display: 'block', padding: '11px 18px', fontSize: 13,
                                    fontWeight: childActive ? 700 : 400,
                                    color: childActive ? 'var(--abed-green)' : '#374151',
                                    background: childActive ? '#f0fdf4' : 'white',
                                    textDecoration: 'none',
                                    borderBottom: '1px solid #f3f4f6',
                                    transition: 'background .1s',
                                  }}
                                  onMouseEnter={e => { if (!childActive) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                                  onMouseLeave={e => { if (!childActive) (e.currentTarget as HTMLElement).style.background = 'white' }}
                                >
                                  {c.label}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <Link key={s.href} href={s.href}
                      style={{
                        display: 'block', padding: '11px 18px', fontSize: 13,
                        fontWeight: active ? 700 : 400,
                        color: active ? 'var(--abed-green)' : '#374151',
                        background: active ? '#f0fdf4' : 'white',
                        textDecoration: 'none',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'white' }}
                    >
                      {s.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* CAF — menu déroulant regroupant CAF Pro / AAF / RH (rôle CAF
              uniquement). Contrairement à l'ancien essai sur AAF, ce menu ne
              duplique pas les onglets d'une barre alignée : chaque entrée
              pointe vers une section différente, qui a sa propre barre. */}
          {effectiveShowCAF ? (
            <div
              style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
              onMouseEnter={() => setCafOpen(true)}
              onMouseLeave={() => setCafOpen(false)}
            >
              <button style={tabStyle(!!cafActive)}>
                CAF <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>▼</span>
              </button>
              {cafOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 200,
                  background: 'white', border: '1px solid var(--abed-border)',
                  borderRadius: '0 0 10px 10px', minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,.10)',
                }}>
                  {cafTabs.map(s => {
                    const active = isActive(s.match)
                    return (
                      <Link key={s.href} href={s.href}
                        style={{
                          display: 'block', padding: '11px 18px', fontSize: 13,
                          fontWeight: active ? 700 : 400,
                          color: active ? 'var(--abed-green)' : '#374151',
                          background: active ? '#f0fdf4' : 'white',
                          textDecoration: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'white' }}
                      >
                        {s.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : effectiveShowAAF && (
            // AAF — lien simple vers le tableau de bord ; le sous-menu se fait
            // via la barre d'onglets alignée dans la section /aaf elle-même
            // (AAFNav), pas via un menu déroulant qui la recouvrirait.
            <Link href="/aaf" style={tabStyle(!!aafActive)}>
              AAF
            </Link>
          )}

          {/* DE — même traitement que AAF seul : lien simple, sous-menu via
              la barre d'onglets alignée dans /de (DENav), pas de menu
              déroulant qui la recouvrirait. */}
          {effectiveShowDE && (
            <Link href="/de" style={tabStyle(!!deActive)}>
              DE
            </Link>
          )}

          {/* BD — même traitement que AAF/DE seuls : lien simple, sous-menu
              via la barre d'onglets alignée dans /bd (BDNav). */}
          {effectiveShowBD && (
            <Link href="/bd" style={tabStyle(!!bdActive)}>
              BD
            </Link>
          )}

          {/* Autres onglets */}
          {mainTabs.map(tab => (
            <Link key={tab.href} href={tab.href} style={tabStyle(isActive(tab.match))}>
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Avatar + lang switcher + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <NotificationBell />
          <UserAvatar userName={userName} userRole={userRole} avatarUrl={avatarUrl} />

          {/* Hamburger — visible only on mobile */}
          <button
            className="nav-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
            style={{
              display: 'none',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6,
              color: '#374151', fontSize: 22, lineHeight: 1,
            }}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div ref={mobileRef} style={{
          position: 'absolute', top: 60, left: 0, right: 0, zIndex: 300,
          background: 'white', borderBottom: '1px solid var(--abed-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
        }}>
          {/* Mon espace */}
          <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--abed-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('dossier')}
          </div>
          {subTabs.map(s => {
            const active = isActive(s.match)
            if (s.kind === 'group') {
              return (
                <div key={s.label}>
                  <div style={{
                    padding: '10px 24px 4px', fontSize: 12, fontWeight: 700,
                    color: active ? 'var(--abed-green)' : '#9ca3af',
                  }}>
                    {s.label}
                  </div>
                  {s.children.map(c => {
                    const childActive = isActive(c.match)
                    return (
                      <Link key={c.href} href={c.href} style={{
                        display: 'block', padding: '10px 24px 10px 36px', fontSize: 14,
                        fontWeight: childActive ? 700 : 400,
                        color: childActive ? 'var(--abed-green)' : '#374151',
                        background: childActive ? '#f0fdf4' : 'white',
                        textDecoration: 'none',
                        borderBottom: '1px solid #f9fafb',
                      }}>
                        {c.label}
                      </Link>
                    )
                  })}
                </div>
              )
            }
            return (
              <Link key={s.href} href={s.href} style={{
                display: 'block', padding: '12px 24px', fontSize: 14,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--abed-green)' : '#374151',
                background: active ? '#f0fdf4' : 'white',
                textDecoration: 'none',
                borderBottom: '1px solid #f9fafb',
              }}>
                {s.label}
              </Link>
            )
          })}

          {/* CAF (CAF Pro / AAF / RH) ou AAF seul */}
          {effectiveShowCAF ? (
            <>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--abed-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderTop: '1px solid var(--abed-border)' }}>
                CAF
              </div>
              {cafTabs.map(s => {
                const active = isActive(s.match)
                return (
                  <Link key={s.href} href={s.href} style={{
                    display: 'block', padding: '12px 24px', fontSize: 14,
                    fontWeight: active ? 700 : 400,
                    color: active ? 'var(--abed-green)' : '#374151',
                    background: active ? '#f0fdf4' : 'white',
                    textDecoration: 'none',
                    borderBottom: '1px solid #f9fafb',
                  }}>
                    {s.label}
                  </Link>
                )
              })}
            </>
          ) : effectiveShowAAF && (
            <Link href="/aaf" style={{
              display: 'block', padding: '12px 24px', fontSize: 14,
              fontWeight: aafActive ? 700 : 400,
              color: aafActive ? 'var(--abed-green)' : '#374151',
              background: aafActive ? '#f0fdf4' : 'white',
              textDecoration: 'none',
              borderBottom: '1px solid #f9fafb',
              borderTop: '1px solid var(--abed-border)',
            }}>
              AAF
            </Link>
          )}

          {effectiveShowDE && (
            <Link href="/de" style={{
              display: 'block', padding: '12px 24px', fontSize: 14,
              fontWeight: deActive ? 700 : 400,
              color: deActive ? 'var(--abed-green)' : '#374151',
              background: deActive ? '#f0fdf4' : 'white',
              textDecoration: 'none',
              borderBottom: '1px solid #f9fafb',
              borderTop: '1px solid var(--abed-border)',
            }}>
              DE
            </Link>
          )}

          {effectiveShowBD && (
            <Link href="/bd" style={{
              display: 'block', padding: '12px 24px', fontSize: 14,
              fontWeight: bdActive ? 700 : 400,
              color: bdActive ? 'var(--abed-green)' : '#374151',
              background: bdActive ? '#f0fdf4' : 'white',
              textDecoration: 'none',
              borderBottom: '1px solid #f9fafb',
              borderTop: '1px solid var(--abed-border)',
            }}>
              BD
            </Link>
          )}

          {/* Autres onglets */}
          {mainTabs.length > 0 && (
            <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--abed-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderTop: '1px solid var(--abed-border)', marginTop: 4 }}>
              Navigation
            </div>
          )}
          {mainTabs.map(tab => {
            const active = isActive(tab.match)
            return (
              <Link key={tab.href} href={tab.href} style={{
                display: 'block', padding: '12px 24px', fontSize: 14,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--abed-green)' : '#374151',
                background: active ? '#f0fdf4' : 'white',
                textDecoration: 'none',
                borderBottom: '1px solid #f9fafb',
              }}>
                {tab.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
    <AgaWidget />
    </>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '0 14px', height: '100%',
    fontSize: 14, fontWeight: active ? 700 : 500,
    color: active ? 'var(--abed-green)' : '#374151',
    textDecoration: 'none',
    borderBottom: active ? '3px solid var(--abed-green)' : '3px solid transparent',
    borderTop: '3px solid transparent',
    borderLeft: 'none', borderRight: 'none',
    background: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color .15s, border-color .15s',
  }
}
