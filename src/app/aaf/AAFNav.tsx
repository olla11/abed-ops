'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/aaf', label: 'Tableau de bord', exact: true },
  { href: '/overview', label: "Vue d'ensemble", exact: true },
  { href: '/aaf/demandes-paiement', label: 'Demandes de paiement' },
  { href: '/aaf/rapports-allocations', label: "Rapports d'allocation" },
  { href: '/aaf/reconciliations', label: 'Réconciliations OM' },
]

export default function AAFNav() {
  const pathname = usePathname()
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 28,
      background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content',
      maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
    }}>
      {TABS.map(tab => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
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
