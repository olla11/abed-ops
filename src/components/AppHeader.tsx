'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import UserAvatar from './UserAvatar'
import AgaWidget from './AgaWidget'
import NotificationBell from './NotificationBell'

type Props = {
  userName?: string
  userRole?: string
  typeEmploi?: string | null
  showAdmin?: boolean
  showRH?: boolean
  avatarUrl?: string | null
}

const OVERVIEW_ROLES = ['aaf','caf','de','admin','administrateur']
const RAPPORT_TYPES = ['benevole','stagiaire_n1','stagiaire_n2','cdd','cdi']

export default function AppHeader({ userName, userRole, typeEmploi, showAdmin, showRH, avatarUrl }: Props) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')
  const isSignataireOrg = ['de', 'administrateur'].includes(userRole ?? '')
  const [dossierOpen, setDossierOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileRef = useRef<HTMLDivElement>(null)

  const subTabs = [
    { href: '/dashboard', label: t('missions'), match: ['/dashboard', '/missions'] },
    { href: '/timesheets', label: estRapport ? t('monthlyReport') : t('timesheets'), match: ['/timesheets'] },
    { href: '/demandes', label: t('payments'), match: ['/demandes'] },
    { href: '/conges', label: t('leaves'), match: ['/conges'] },
    { href: '/signatures', label: t('signatures'), match: ['/signatures'] },
    { href: '/mes-contrats', label: t('contracts'), match: ['/mes-contrats'] },
    ...(isSignataireOrg ? [{ href: '/contrats-a-signer', label: t('contractsToSign'), match: ['/contrats-a-signer'] }] : []),
  ]

  const mainTabs = [
    { href: '/statut', label: t('status'), match: ['/statut'] },
    { href: '/projets', label: t('projects'), match: ['/projets'] },
    ...(showOverview ? [{ href: '/overview', label: t('overview'), match: ['/overview'] }] : []),
    ...(showRH ? [{ href: '/rh', label: t('rh'), match: ['/rh'] }] : []),
    ...(showAdmin ? [{ href: '/admin', label: t('admin'), match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  const dossierActive = subTabs.some(s => isActive(s.match))

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
