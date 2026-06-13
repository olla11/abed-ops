'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import UserAvatar from './UserAvatar'

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
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')
  const [dossierOpen, setDossierOpen] = useState(false)

  const subTabs = [
    { href: '/dashboard', label: 'Ordres de mission', match: ['/dashboard', '/missions'] },
    { href: '/timesheets', label: estRapport ? 'Rapport mensuel' : 'Timesheet', match: ['/timesheets'] },
    { href: '/demandes', label: 'Demande de paiement', match: ['/demandes'] },
    { href: '/conges', label: 'Mes congés', match: ['/conges'] },
  ]

  const mainTabs = [
    { href: '/statut', label: 'Statut', match: ['/statut'] },
    ...(showOverview ? [{ href: '/overview', label: "Vue d'ensemble", match: ['/overview'] }] : []),
    ...(showRH ? [{ href: '/rh', label: 'RH', match: ['/rh'] }] : []),
    ...(showAdmin ? [{ href: '/admin', label: 'Admin', match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  const dossierActive = subTabs.some(s => isActive(s.match))

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'white',
      borderBottom: '1px solid var(--abed-border)',
      boxShadow: '0 1px 8px rgba(0,0,0,.06)',
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px',
        display: 'flex', alignItems: 'center',
        height: 60, gap: 8,
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0, marginRight: 16 }}>
          <Image src="/logoabed2.png" alt="Logo ABED" width={36} height={36} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--abed-green)', letterSpacing: 0.5 }}>My ABED</span>
        </Link>

        {/* Onglets */}
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, height: '100%', gap: 2 }}>

          {/* Mon espace (dropdown) */}
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
            onMouseEnter={() => setDossierOpen(true)}
            onMouseLeave={() => setDossierOpen(false)}
          >
            <button style={tabStyle(dossierActive)}>
              Mon espace <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>▼</span>
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

        {/* Avatar */}
        <UserAvatar userName={userName} userRole={userRole} avatarUrl={avatarUrl} />
      </div>
    </nav>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '0 16px', height: '100%',
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
