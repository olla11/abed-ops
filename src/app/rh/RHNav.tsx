'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ALL_TABS = [
  { href: '/rh', label: 'Tableau de bord', exact: true },
  { href: '/rh/personnel', label: 'Personnel' },
  { href: '/rh/contrats', label: 'Contrats' },
  { href: '/rh/conges', label: 'Congés' },
  { href: '/rh/evaluations', label: 'Évaluations' },
]

export default function RHNav({ role }: { role?: string } = {}) {
  const pathname = usePathname()
  const TABS = ['de', 'dp', 'administrateur'].includes(role ?? '')
    ? ALL_TABS.filter(t => t.href === '/rh/conges')
    : ALL_TABS
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
