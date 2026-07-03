'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, Tag, Zap, HardDrive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/admin/comptes',  label: 'Comptes',       Icon: Users },
  { href: '/admin/roles',    label: 'Rôles',         Icon: Shield },
  { href: '/admin/titres',   label: 'Titres',        Icon: Tag },
  { href: '/admin/actions',  label: 'Actions par lot', Icon: Zap },
  { href: '/admin/stockage', label: 'Stockage',      Icon: HardDrive },
]

export default function AdminNav({ role }: { role: string }) {
  const path = usePathname()
  const tabs = role === 'admin' ? TABS : TABS.filter(t => t.href !== '/admin/stockage')

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Administration</h2>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--abed-border)', paddingBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {tabs.map(t => {
          const active = path === t.href || (path === '/admin' && t.href === '/admin/comptes')
          return (
            <Link key={t.href} href={t.href} style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--abed-green)' : 'var(--abed-muted)',
              borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
              marginBottom: -2,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}>
              <t.Icon size={15} strokeWidth={1.75} />
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
