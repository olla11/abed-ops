'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import UserAvatar from './UserAvatar'
import AgaWidget from './AgaWidget'
import NotificationBell from './NotificationBell'
import AuthToast from './AuthToast'
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
  // Certaines pages (ex. /evaluations/[id]) sont partagées entre deux
  // contextes de navigation : l'évalué·e/évaluateur qui consulte SON PROPRE
  // dossier (à juste titre sous "Mon espace"), et la CAF/RH qui y vient
  // depuis /rh/évaluations pour rendre une décision sur le dossier de
  // quelqu'un d'autre — dans ce second cas, "Mon espace" qui s'allume est
  // trompeur. La page appelante sait laquelle des deux situations c'est
  // (elle seule connaît le dossier consulté) et le précise ici.
  forceRHActive?: boolean
  avatarUrl?: string | null
}

// Vue d'ensemble reste un onglet principal pour la CAF (elle garde son accès
// direct) et pour de/dp/admin — pour AAF (seul), elle est transposée en
// premier sous-menu du menu "AAF" (voir aafTabs ci-dessous) plutôt que
// dupliquée aux deux endroits.
const OVERVIEW_ROLES = ['de','dp','caf','admin','administrateur','superadmin']

export default function AppHeader({ userName, userRole, userTitre, typeEmploi, showAdmin, showRH, showAAF, showCAF, showDE, showBD, forceRHActive, avatarUrl }: Props) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  // Repli calculé directement depuis le rôle effectif si l'appelant n'a pas
  // fourni la prop explicitement — évite la classe de bug déjà rencontrée
  // avec showAAF (des pages qui oubliaient de la passer perdaient le menu).
  const effectiveShowAAF = showAAF ?? roleEstAAF(userRole)
  // Admin/superadmin doivent pouvoir agir directement sur les dossiers RH
  // (personnel, évaluations...) sans passer par l'aperçu de rôle — l'onglet
  // RH leur reste donc accessible même quand la page appelante a transmis
  // showRH={estRH(role)} (false pour eux), d'où le OR après le repli au
  // lieu d'un simple ??.
  const effectiveShowRH = (showRH ?? roleEstRH(userRole)) || ['admin', 'superadmin'].includes(userRole ?? '')
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
  const [cafOpen, setCafOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileRef = useRef<HTMLDivElement>(null)

  // "Mon espace" n'est plus un menu déroulant : chacune de ses pages affiche
  // désormais une barre latérale permanente (voir MonEspaceNav), qui liste
  // ces mêmes destinations (dont "Doc & Sign" et "Contrats & Évaluations",
  // autrefois des sous-menus en survol). Ici, un simple lien vers /dashboard,
  // actif dès qu'on est sur l'une de ces pages.
  const MON_ESPACE_PATHS = ['/dashboard', '/missions', '/timesheets', '/demandes', '/conges', '/documents', '/signatures', '/mes-contrats', '/evaluations']

  // Appellations volontairement différentes de "Mon espace" (verbe d'action en
  // tête) : ce menu sert à traiter les dossiers d'autrui, pas à consulter les
  // siens — la distinction doit se voir dans le libellé, pas seulement dans le lien.
  // /bd n'a pas son propre onglet en tête pour ces rôles (BDNav.tsx l'insère
  // en sous-menu de "Vue d'ensemble" pour les superviseurs qui n'ont pas le
  // titre BD) — l'onglet doit donc rester allumé quand on y est, sinon on
  // perd le repère de "dans quel menu suis-je". Exclu seulement si la
  // personne a par ailleurs son propre onglet "BD" dédié (effectiveShowBD),
  // pour ne pas allumer les deux à la fois dans ce cas.
  const matchVueEnsemble = effectiveShowBD ? ['/overview'] : ['/overview', '/bd']
  const aafTabs = [
    { href: '/overview', label: "Vue d'ensemble", match: matchVueEnsemble },
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
    ...(showOverview ? [{ href: '/overview', label: t('overview'), match: matchVueEnsemble }] : []),
    // RH : masqué ici quand le menu CAF est actif, il y figure déjà en sous-entrée.
    ...(effectiveShowRH && !effectiveShowCAF ? [{ href: '/rh', label: t('rh'), match: ['/rh'] }] : []),
    ...(showAdmin ? [{ href: '/admin', label: t('admin'), match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  // forceRHActive : la page consultée est partagée avec "Mon espace" (même
  // route pour son propre dossier et pour agir en tant que CAF/RH sur celui
  // d'un tiers) — dans ce second cas, "Mon espace" ne doit pas s'allumer,
  // et le menu CAF (ou l'onglet RH pour la RH littérale) s'allume à la place.
  const dossierActive = !forceRHActive && isActive(MON_ESPACE_PATHS)
  const aafActive = effectiveShowAAF && (isActive(['/aaf']) || aafTabs.some(s => isActive(s.match)))
  const cafActive = effectiveShowCAF && (cafTabs.some(s => isActive(s.match)) || forceRHActive)
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
    <AuthToast />
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

          {/* Mon espace — lien simple ; le sous-menu (dont Doc & Sign et
              Contrats & Évaluations) vit désormais dans une barre latérale
              permanente sur chacune de ces pages (voir MonEspaceNav), plutôt
              que dans un menu déroulant du haut. */}
          <Link href="/dashboard" style={tabStyle(dossierActive)}>
            {t('dossier')}
          </Link>

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
            <Link key={tab.href} href={tab.href} style={tabStyle(isActive(tab.match) || (!!forceRHActive && tab.href === '/rh'))}>
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
          {/* Mon espace — lien simple, comme en desktop (voir plus haut). */}
          <Link href="/dashboard" style={{
            display: 'block', padding: '12px 24px', fontSize: 14,
            fontWeight: dossierActive ? 700 : 400,
            color: dossierActive ? 'var(--abed-green)' : '#374151',
            background: dossierActive ? '#f0fdf4' : 'white',
            textDecoration: 'none',
            borderBottom: '1px solid #f9fafb',
          }}>
            {t('dossier')}
          </Link>

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
            const active = isActive(tab.match) || (!!forceRHActive && tab.href === '/rh')
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
