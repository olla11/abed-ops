'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, Tag, Zap, HardDrive, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'

type Tab = { href: string; labelKey: string; Icon: LucideIcon; adminOnly?: boolean }

const TABS: Tab[] = [
  { href: '/admin/comptes',       labelKey: 'accounts',      Icon: Users },
  { href: '/admin/inscriptions',  labelKey: 'inscriptions',  Icon: UserPlus },
  { href: '/admin/roles',         labelKey: 'roles',         Icon: Shield },
  { href: '/admin/titres',        labelKey: 'titles',        Icon: Tag },
  { href: '/admin/actions',       labelKey: 'batchActions',  Icon: Zap },
  { href: '/admin/stockage',      labelKey: 'storage',       Icon: HardDrive, adminOnly: true },
]

export default function AdminNav({ role, pendingCount }: { role: string; pendingCount?: number }) {
  const path = usePathname()
  const ta = useTranslations('admin')
  const tabs = TABS.filter(t => !t.adminOnly || role === 'admin')

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← {ta('title')}</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>{ta('title')}</h2>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--abed-border)', paddingBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {tabs.map(tab => {
          const active = path === tab.href || (path === '/admin' && tab.href === '/admin/comptes')
          const count = tab.href === '/admin/inscriptions' ? (pendingCount ?? 0) : 0
          return (
            <Link key={tab.href} href={tab.href} style={{
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
              position: 'relative',
            }}>
              <tab.Icon size={15} strokeWidth={1.75} />
              {ta(tab.labelKey as any)}
              {count > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px', lineHeight: 1.5 }}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
