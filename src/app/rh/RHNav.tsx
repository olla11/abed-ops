'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/rh', label: 'Tableau de bord', exact: true },
  { href: '/rh/personnel', label: 'Personnel' },
  { href: '/rh/contrats', label: 'Contrats' },
  { href: '/rh/conges', label: 'Congés' },
  { href: '/rh/evaluations', label: 'Évaluations' },
]

export default function RHNav() {
  const pathname = usePathname()
  return (
    <div style={{
      display: 'flex', gap: 0, marginBottom: 28,
      borderBottom: '2px solid var(--abed-border)',
    }}>
      {TABS.map(tab => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link key={tab.href} href={tab.href} style={{
            padding: '8px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
            color: active ? 'var(--abed-green)' : '#374151',
            textDecoration: 'none',
            borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
            marginBottom: -2, whiteSpace: 'nowrap',
            transition: 'color .15s',
          }}>
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
