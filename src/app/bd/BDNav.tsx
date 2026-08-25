'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS_BASE = [
  { href: '/bd', label: 'Tableau de bord', exact: true },
  { href: '/bd/calendrier', label: 'Calendrier' },
  { href: '/bd/opportunites', label: 'Opportunités' },
]

// "Rapport" est un outil de travail de l'équipe BD — pas partagé avec les
// superviseurs qui consultent /bd en lecture seule depuis Vue d'ensemble.
export default function BDNav({ estEquipeBD }: { estEquipeBD: boolean }) {
  const pathname = usePathname()
  const TABS = estEquipeBD ? [...TABS_BASE, { href: '/bd/rapport', label: 'Rapport' }] : TABS_BASE
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
