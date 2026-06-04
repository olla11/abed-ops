'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

type Props = {
  userName?: string
  userRole?: string
  showAdmin?: boolean
}

export default function AppHeader({ userName, userRole, showAdmin }: Props) {
  const pathname = usePathname()

  const tabs = [
    { href: '/dashboard', label: 'OM', match: ['/dashboard', '/missions'] },
    { href: '/timesheets', label: 'Timesheets', match: ['/timesheets'] },
    { href: '/profile', label: 'Mon profil', match: ['/profile'] },
    ...(showAdmin ? [{ href: '/admin', label: 'Admin', match: ['/admin'] }] : []),
  ]

  function isActive(match: string[]) {
    return match.some(m => pathname === m || pathname.startsWith(m + '/'))
  }

  return (
    <header style={{ marginBottom: 28, paddingBottom: 0, borderBottom: '2px solid var(--abed-green)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Image src="/logoabed2.png" alt="Logo ABED" width={56} height={56} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--abed-green)', fontWeight: 700, lineHeight: 1.2, maxWidth: 340 }}>
              AGRICULTURE POUR LE BIEN ÊTRE ET LE DÉVELOPPEMENT DURABLE
            </div>
            <div style={{ fontSize: 18, color: 'var(--abed-green)', fontWeight: 800, letterSpacing: 1 }}>
              ABED-ONG
            </div>
            <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
              Système de Gestion des Opérations
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
      <nav style={{ display: 'flex', gap: 4, marginBottom: -2 }}>
        {tabs.map(tab => {
          const active = isActive(tab.match)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '8px 22px',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? 'white' : 'var(--abed-green)',
                background: active ? 'var(--abed-green)' : 'transparent',
                border: '2px solid var(--abed-green)',
                borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                textDecoration: 'none',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
