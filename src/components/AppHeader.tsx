'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import LogoutButton from './LogoutButton'

type Props = {
  userName?: string
  userRole?: string
  typeEmploi?: string | null
  showAdmin?: boolean
}

const OVERVIEW_ROLES = ['aaf','caf','de','admin','administrateur']
const RAPPORT_TYPES = ['benevole','stagiaire_n1','stagiaire_n2','cdd','cdi']

export default function AppHeader({ userName, userRole, typeEmploi, showAdmin }: Props) {
  const pathname = usePathname()
  const [dossierOpen, setDossierOpen] = useState(false)
  const showOverview = OVERVIEW_ROLES.includes(userRole ?? '')
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')

  // sous-onglets Mes dossiers
  const subTabs = [
    { href: '/dashboard', label: 'Ordres de mission', match: ['/dashboard', '/missions'] },
    {
      href: '/timesheets',
      label: estRapport ? 'Rapport mensuel' : 'Timesheet',
      match: ['/timesheets'],
    },
    { href: '/demandes', label: 'Demande de paiement', match: ['/demandes'] },
  ]

  const dossierActive = subTabs.some(s => s.match.some(m => pathname === m || pathname.startsWith(m + '/')))

  const extraTabs = [
    { href: '/statut', label: 'Statut', match: ['/statut'] },
    ...(showOverview ? [{ href: '/overview', label: "Vue d'ensemble", match: ['/overview'] }] : []),
    { href: '/profile', label: 'Mon profil', match: ['/profile'] },
    ...(showAdmin ? [{ href: '/admin', label: 'Admin', match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  const tabBase = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? 'white' : 'var(--abed-green)',
    background: active ? 'var(--abed-green)' : 'transparent',
    border: '2px solid var(--abed-green)',
    borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
    borderRadius: '6px 6px 0 0',
    textDecoration: 'none',
    transition: 'all .15s',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <header style={{ marginBottom: 28, paddingBottom: 0, borderBottom: '2px solid var(--abed-green)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Image src="/logoabed2.png" alt="Logo ABED" width={56} height={56} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--abed-green)', fontWeight: 700, lineHeight: 1.2, maxWidth: 340 }}>
              AGRICULTURE POUR LE BIEN ÊTRE ET LE DÉVELOPPEMENT DURABLE
            </div>
            <div style={{ fontSize: 20, color: 'var(--abed-green)', fontWeight: 900, letterSpacing: 1 }}>
              My ABED
            </div>
            <div style={{ fontSize: 11, color: 'var(--abed-muted)', fontStyle: 'italic' }}>
              Chers collègues, tout se passe ici à ABED 🌿
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {userName && (
            <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
              {userName} · <strong>{userRole?.toUpperCase()}</strong>
            </span>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Onglets */}
      <nav style={{ display: 'flex', gap: 4, marginBottom: -2, alignItems: 'flex-end' }}>

        {/* ── Mes dossiers (dropdown) ── */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setDossierOpen(true)}
          onMouseLeave={() => setDossierOpen(false)}
        >
          <div style={{ ...tabBase(dossierActive), display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
            Mes dossiers
            <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
          </div>

          {dossierOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'white', border: '2px solid var(--abed-green)',
              borderRadius: '0 6px 6px 6px', minWidth: 220,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}>
              {subTabs.map(s => {
                const active = isActive(s.match)
                return (
                  <Link key={s.href} href={s.href}
                    style={{
                      display: 'block', padding: '10px 18px', fontSize: 13,
                      fontWeight: active ? 700 : 400,
                      color: active ? 'white' : '#374151',
                      background: active ? 'var(--abed-green)' : 'white',
                      textDecoration: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f0fdf4' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'white' }}
                  >
                    {s.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Autres onglets ── */}
        {extraTabs.map(tab => {
          const active = isActive(tab.match)
          return (
            <Link key={tab.href} href={tab.href} style={tabBase(active)}>
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
