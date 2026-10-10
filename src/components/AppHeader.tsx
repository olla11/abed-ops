'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, Clock, Wallet, Palmtree, PenTool, FileText, ClipboardCheck,
  Landmark, CreditCard, Users, FileSignature, Target, ClipboardList, FolderKanban,
  FileEdit, BookOpen, LayoutGrid, Settings, Bell, UserCircle, Home,
  ClipboardEdit, Scale, Banknote, TrendingUp, Calendar, FileBarChart,
  UserPlus, Shield, Tag, Zap, HardDrive, QrCode, History, ScrollText, BarChart3,
} from 'lucide-react'
import UserAvatar from './UserAvatar'
import AgaWidget from './AgaWidget'
import NotificationBell from './NotificationBell'
import AuthToast from './AuthToast'
import MobileTabBar from './mobile/MobileTabBar'
import MobileMenuSheet, { type MenuGroup } from './mobile/MobileMenuSheet'
import MobileTableCards from './mobile/MobileTableCards'
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
const RAPPORT_TYPES = ['benevole', 'stagiaire_n1', 'stagiaire_n2', 'cdd', 'cdi']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur système', superadmin: 'Super administrateur', rh: 'Ressources Humaines',
  caf: 'CAF', de: 'Directeur Exécutif', dp: 'Directeur des Programmes', aaf: 'AAF',
  administrateur: "Conseil d'Administration", manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

export default function AppHeader({ userName, userRole, userTitre, typeEmploi, showAdmin, showRH, showAAF, showCAF, showDE, showBD, forceRHActive, avatarUrl }: Props) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  const effectiveShowAAF = showAAF ?? roleEstAAF(userRole)
  const effectiveShowRH = (showRH ?? roleEstRH(userRole)) || ['admin', 'superadmin'].includes(userRole ?? '')
  const effectiveShowCAF = showCAF ?? roleEstCAF(userRole)
  const effectiveShowDE = showDE ?? roleEstDE(userRole)
  const effectiveShowBD = showBD ?? titreEstBD(userTitre)
  const [cafOpen, setCafOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const MON_ESPACE_PATHS = ['/dashboard', '/missions', '/timesheets', '/demandes', '/conges', '/documents', '/signatures', '/mes-contrats', '/evaluations']

  const matchVueEnsemble = effectiveShowBD ? ['/overview'] : ['/overview', '/bd']
  const aafTabs = [
    { href: '/overview', label: "Vue d'ensemble", match: matchVueEnsemble },
    { href: '/aaf/demandes-paiement', label: 'Traiter les demandes de paiement', match: ['/aaf/demandes-paiement'] },
    { href: '/aaf/besoins', label: 'Traiter les expressions de besoin', match: ['/aaf/besoins'] },
    { href: '/aaf/rapports-allocations', label: "Traiter les rapports d'allocation", match: ['/aaf/rapports-allocations'] },
    { href: '/aaf/reconciliations', label: 'Valider les réconciliations OM', match: ['/aaf/reconciliations'] },
  ]

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
    ...(effectiveShowRH && !effectiveShowCAF ? [{ href: '/rh', label: t('rh'), match: ['/rh'] }] : []),
    ...(showAdmin ? [{ href: '/admin', label: t('admin'), match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  const dossierActive = !forceRHActive && isActive(MON_ESPACE_PATHS)
  const aafActive = effectiveShowAAF && (isActive(['/aaf']) || aafTabs.some(s => isActive(s.match)))
  const cafActive = effectiveShowCAF && (cafTabs.some(s => isActive(s.match)) || forceRHActive)
  const deActive = effectiveShowDE && isActive(['/de'])
  const bdActive = effectiveShowBD && isActive(['/bd'])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // ── Menu mobile (onglet "Menu" de la barre du bas) ──
  // Mêmes destinations que la nav desktop + MonEspaceNav, regroupées par
  // section. Les sections de traitement n'apparaissent que pour les rôles
  // qui y ont accès (mêmes règles que les onglets desktop ci-dessus).
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')
  const a = (href: string, exact = false) => exact ? pathname === href : isActive([href])
  // Miroir des barres latérales desktop (MonEspaceNav, DENav, AAFNav,
  // CAFNav, RHNav, BDNav, AdminNav) : toute entrée ajoutée là-bas doit
  // aussi être ajoutée ici, sinon elle est invisible sur mobile.
  const estAdminSys = ['admin', 'superadmin'].includes(userRole ?? '')
  const rhLimite = ['de', 'dp', 'administrateur'].includes(userRole ?? '')
  const menuGroups: MenuGroup[] = [
    { title: t('dossier'), items: [
      { href: '/accueil', label: 'Accueil', Icon: Home, active: a('/accueil') },
      { href: '/dashboard', label: t('missions'), Icon: LayoutDashboard, active: a('/dashboard') },
      { href: '/timesheets', label: estRapport ? t('monthlyReport') : t('timesheets'), Icon: Clock, active: a('/timesheets') },
      { href: '/demandes', label: t('payments'), Icon: Wallet, active: a('/demandes') },
      { href: '/besoins', label: 'Expression de besoin', Icon: ClipboardList, active: a('/besoins') },
      { href: '/conges', label: t('leaves'), Icon: Palmtree, active: a('/conges') },
      { href: '/signatures', label: 'Signature directe', Icon: PenTool, active: a('/signatures') },
      { href: '/documents', label: 'Documents', Icon: FileText, active: a('/documents') },
      { href: '/mes-contrats', label: t('contracts'), Icon: FileText, active: a('/mes-contrats') },
      { href: '/evaluations', label: t('evaluations'), Icon: ClipboardCheck, active: a('/evaluations') },
    ]},
    ...(effectiveShowDE ? [{ title: 'DE', items: [
      { href: '/de', label: 'Tableau de bord', Icon: LayoutDashboard, active: a('/de', true) },
      { href: '/de/om-a-signer', label: 'OM à signer', Icon: FileSignature, active: a('/de/om-a-signer') },
      { href: '/de/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet, active: a('/de/demandes-paiement') },
      { href: '/de/besoins', label: 'Expressions de besoin', Icon: ClipboardEdit, active: a('/de/besoins') },
      { href: '/de/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList, active: a('/de/rapports-allocations') },
      { href: '/de/reconciliations', label: 'Réconciliations OM', Icon: Scale, active: a('/de/reconciliations') },
      { href: '/de/timesheets', label: 'Timesheets', Icon: Clock, active: a('/de/timesheets') },
    ]}] : []),
    ...(effectiveShowCAF ? [{ title: 'CAF Pro', items: [
      { href: '/caf', label: 'Tableau de bord', Icon: LayoutDashboard, active: a('/caf', true) },
      { href: '/caf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet, active: a('/caf/demandes-paiement') },
      { href: '/caf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList, active: a('/caf/rapports-allocations') },
      { href: '/caf/reconciliations', label: 'Réconciliations OM', Icon: Scale, active: a('/caf/reconciliations') },
      { href: '/caf/timesheets', label: 'Timesheets & paiements', Icon: Clock, active: a('/caf/timesheets') },
      { href: '/caf/pay-roll', label: 'Pay Roll', Icon: Banknote, active: a('/caf/pay-roll') },
      { href: '/caf/execution-financiere', label: 'Exécution financière', Icon: TrendingUp, active: a('/caf/execution-financiere') },
    ]}] : []),
    ...((effectiveShowAAF || effectiveShowCAF) ? [{ title: 'AAF', items: [
      { href: '/aaf', label: 'Tableau de bord', Icon: LayoutDashboard, active: a('/aaf', true) },
      ...(userRole === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", Icon: LayoutGrid, active: a('/overview', true) }] : []),
      { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet, active: a('/aaf/demandes-paiement') },
      { href: '/aaf/besoins', label: 'Expressions de besoin', Icon: ClipboardEdit, active: a('/aaf/besoins') },
      { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList, active: a('/aaf/rapports-allocations') },
      { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale, active: a('/aaf/reconciliations') },
      { href: '/aaf/pay-roll', label: 'Pay Roll', Icon: Banknote, active: a('/aaf/pay-roll') },
      { href: '/aaf/bons-de-commande', label: 'Bon de commande', Icon: FileText, active: a('/aaf/bons-de-commande') },
    ]}] : []),
    ...(effectiveShowRH ? [{ title: 'RH', items: rhLimite ? [
      { href: '/rh/conges', label: 'Congés', Icon: Palmtree, active: a('/rh/conges') },
    ] : [
      { href: '/rh', label: 'Tableau de bord', Icon: LayoutDashboard, active: a('/rh', true) },
      { href: '/rh/personnel', label: 'Personnel', Icon: Users, active: a('/rh/personnel') },
      { href: '/rh/contrats', label: 'Contrats', Icon: FileText, active: a('/rh/contrats') },
      { href: '/rh/paie', label: 'Paie', Icon: Wallet, active: a('/rh/paie') },
      { href: '/rh/conges', label: 'Congés', Icon: Palmtree, active: a('/rh/conges') },
      { href: '/rh/evaluations', label: 'Évaluations', Icon: ClipboardCheck, active: a('/rh/evaluations') },
      { href: '/rh/parametres', label: 'Paramètres RH', Icon: Settings, active: a('/rh/parametres') },
    ]}] : []),
    ...(effectiveShowBD ? [{ title: 'BD', items: [
      { href: '/bd', label: 'Tableau de bord', Icon: LayoutDashboard, active: a('/bd', true) },
      { href: '/bd/calendrier', label: 'Calendrier', Icon: Calendar, active: a('/bd/calendrier') },
      { href: '/bd/opportunites', label: 'Opportunités', Icon: Target, active: a('/bd/opportunites') },
      { href: '/bd/rapport', label: 'Rapport', Icon: FileBarChart, active: a('/bd/rapport') },
    ]}] : []),
    { title: 'Navigation', items: mainTabs.filter(tab => tab.href !== '/rh').map(tab => ({
      href: tab.href, label: tab.label, active: isActive(tab.match),
      Icon: ({ '/statut': ClipboardList, '/projets': FolderKanban, '/tdr': FileEdit, '/ressources': BookOpen, '/overview': LayoutGrid, '/admin': Settings } as Record<string, typeof Home>)[tab.href] ?? LayoutGrid,
    })) },
    ...(showAdmin ? [{ title: 'Administration', items: [
      { href: '/admin/comptes', label: 'Comptes', Icon: Users, active: a('/admin/comptes') },
      { href: '/admin/inscriptions', label: 'Inscriptions', Icon: UserPlus, active: a('/admin/inscriptions') },
      ...(userRole !== 'caf' ? [{ href: '/admin/roles', label: 'Rôles', Icon: Shield, active: a('/admin/roles') }] : []),
      { href: '/admin/titres', label: 'Titres', Icon: Tag, active: a('/admin/titres') },
      { href: '/admin/actions', label: 'Actions groupées', Icon: Zap, active: a('/admin/actions') },
      ...(estAdminSys ? [
        { href: '/admin/stockage', label: 'Stockage', Icon: HardDrive, active: a('/admin/stockage') },
        { href: '/admin/presence', label: 'Présence', Icon: QrCode, active: a('/admin/presence') },
        { href: '/admin/signatures', label: 'Journal des signatures', Icon: History, active: a('/admin/signatures') },
      ] : []),
      ...(userRole === 'superadmin' ? [
        { href: '/admin/journal', label: 'Journal', Icon: ScrollText, active: a('/admin/journal') },
        { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3, active: a('/admin/analytics') },
      ] : []),
    ]}] : []),
    { title: 'Compte', items: [
      { href: '/notifications', label: 'Notifications', Icon: Bell, active: a('/notifications') },
      { href: '/profile', label: 'Mon profil', Icon: UserCircle, active: a('/profile') },
      { href: '/parametres', label: 'Paramètres', Icon: Settings, active: a('/parametres') },
    ]},
  ]

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

        <Link href="/accueil" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0, marginRight: 8 }}>
          <Image src="/logoabed2.png" alt="Logo ABED" width={34} height={34} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--abed-green)', letterSpacing: 0.5 }}>My ABED</span>
        </Link>

        {/* Onglets desktop (inchangés) */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'stretch', flex: 1, height: '100%', gap: 2 }}>

          <Link href="/dashboard" style={tabStyle(dossierActive)}>
            {t('dossier')}
          </Link>

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
            <Link href="/aaf" style={tabStyle(!!aafActive)}>
              AAF
            </Link>
          )}

          {effectiveShowDE && (
            <Link href="/de" style={tabStyle(!!deActive)}>
              DE
            </Link>
          )}

          {effectiveShowBD && (
            <Link href="/bd" style={tabStyle(!!bdActive)}>
              BD
            </Link>
          )}

          {mainTabs.map(tab => (
            <Link key={tab.href} href={tab.href} style={tabStyle(isActive(tab.match) || (!!forceRHActive && tab.href === '/rh'))}>
              {tab.label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <NotificationBell />
          <UserAvatar userName={userName} userRole={userRole} avatarUrl={avatarUrl} />
        </div>
      </div>
    </nav>

    {/* Mobile (≤768px) : barre d'onglets en bas + menu plein écran */}
    <MobileMenuSheet
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
      userName={userName}
      roleLabel={ROLE_LABELS[userRole ?? ''] ?? userRole}
      groups={menuGroups}
    />
    <MobileTabBar role={userRole} titre={userTitre} menuOpen={mobileOpen} onMenu={() => setMobileOpen(o => !o)} />
    <MobileTableCards />
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
