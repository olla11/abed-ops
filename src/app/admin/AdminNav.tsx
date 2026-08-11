'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, Tag, Zap, HardDrive, UserPlus, ScrollText, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'

type Tab = { href: string; labelKey: string; Icon: LucideIcon; adminOnly?: boolean; superadminOnly?: boolean; hiddenForCaf?: boolean }

const TABS: Tab[] = [
  { href: '/admin/comptes',       labelKey: 'accounts',      Icon: Users },
  { href: '/admin/inscriptions',  labelKey: 'inscriptions',  Icon: UserPlus },
  // Rôles reste réservé à admin/superadmin. Titres est visible pour la CAF
  // aussi : c'est elle qui fixe l'ancienneté (donc le taux du barème) même
  // si elle ne peut pas changer le titre/poste lui-même (voir GestionTitres).
  { href: '/admin/roles',         labelKey: 'roles',         Icon: Shield, hiddenForCaf: true },
  { href: '/admin/titres',        labelKey: 'titles',        Icon: Tag },
  { href: '/admin/actions',       labelKey: 'batchActions',  Icon: Zap },
  { href: '/admin/stockage',      labelKey: 'storage',       Icon: HardDrive, adminOnly: true },
  { href: '/admin/journal',       labelKey: 'journal',       Icon: ScrollText, superadminOnly: true },
  { href: '/admin/analytics',     labelKey: 'analytics',     Icon: BarChart3,  superadminOnly: true },
]

export default function AdminNav({ role, pendingCount }: { role: string; pendingCount?: number }) {
  const path = usePathname()
  const ta = useTranslations('admin')
  const tabs = TABS.filter(t =>
    (!t.adminOnly || ['admin', 'superadmin'].includes(role))
    && (!t.superadminOnly || role === 'superadmin')
    && (!t.hiddenForCaf || role !== 'caf')
  )

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← {ta('title')}</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>{ta('title')}</h2>
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {tabs.map(tab => {
          const active = path === tab.href || (path === '/admin' && tab.href === '/admin/comptes')
          const count = tab.href === '/admin/inscriptions' ? (pendingCount ?? 0) : 0
          return (
            <Link key={tab.href} href={tab.href} style={{
              padding: '9px 20px',
              fontSize: 14,
              fontWeight: active ? 700 : 500,
              border: 'none',
              borderRadius: 8,
              background: active ? 'var(--abed-green)' : 'transparent',
              color: active ? 'white' : '#374151',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <tab.Icon size={16} strokeWidth={1.75} />
              {ta(tab.labelKey as any)}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                  background: active ? 'rgba(255,255,255,.25)' : '#ef4444',
                  color: 'white',
                }}>
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
