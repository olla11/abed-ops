'use client'
import { Users, Shield, Tag, Zap, HardDrive, UserPlus, ScrollText, BarChart3, QrCode, History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

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
  { href: '/admin/presence',      labelKey: 'presence',      Icon: QrCode,    adminOnly: true },
  { href: '/admin/signatures',    labelKey: 'signaturesJournal', Icon: History, adminOnly: true },
  { href: '/admin/journal',       labelKey: 'journal',       Icon: ScrollText, superadminOnly: true },
  { href: '/admin/analytics',     labelKey: 'analytics',     Icon: BarChart3,  superadminOnly: true },
]

export default function AdminNav({ role, pendingCount }: { role: string; pendingCount?: number }) {
  const ta = useTranslations('admin')
  const tabs = TABS.filter(t =>
    (!t.adminOnly || ['admin', 'superadmin'].includes(role))
    && (!t.superadminOnly || role === 'superadmin')
    && (!t.hiddenForCaf || role !== 'caf')
  )

  return (
    <SectionSideNav
      items={tabs.map(tab => ({
        href: tab.href,
        label: ta(tab.labelKey as any),
        Icon: tab.Icon,
        badge: tab.href === '/admin/inscriptions' ? (pendingCount ?? 0) : undefined,
      }))}
    />
  )
}
