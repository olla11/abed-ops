'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Sous-onglets de "Vue d'ensemble" : le contenu opérationnel existant, et le
// registre BD en lecture seule (auparavant un menu BD séparé pour le DE et
// les autres superviseurs — désormais regroupé ici, sous Vue d'ensemble,
// pour tous les rôles qui y ont accès).
const TABS = [
  { href: '/overview', label: "Vue d'ensemble des opérations" },
  { href: '/bd', label: 'BD' },
]

export default function OverviewSubNav() {
  const pathname = usePathname()
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 8,
      background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content',
      maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link key={tab.href} href={tab.href} style={{
            padding: '9px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
            border: 'none', borderRadius: 8,
            background: active ? 'var(--abed-green)' : 'transparent',
            color: active ? 'white' : '#374151',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
