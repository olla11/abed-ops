import Image from 'next/image'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

type Props = {
  userName?: string
  userRole?: string
  showAdmin?: boolean
}

export default function AppHeader({ userName, userRole, showAdmin }: Props) {
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 28, paddingBottom: 16, borderBottom: '2px solid var(--abed-green)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Image src="/logo.png" alt="Logo ABED" width={56} height={56} style={{ objectFit: 'contain' }} />
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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {userName && (
          <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
            {userName} · <strong>{userRole?.toUpperCase()}</strong>
          </span>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/missions/nouveau" className="btn" style={{ fontSize: 13 }}>+ Nouvel OM</Link>
          <Link href="/timesheets" className="btn secondary" style={{ fontSize: 13 }}>Timesheets</Link>
          {showAdmin && (
            <Link href="/admin" className="btn secondary" style={{ fontSize: 13 }}>Admin</Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
