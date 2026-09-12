'use client'
import { LayoutDashboard, Users, FileText, Wallet, Palmtree, ClipboardCheck, Settings } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

const ALL_TABS = [
  { href: '/rh', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
  { href: '/rh/personnel', label: 'Personnel', Icon: Users },
  { href: '/rh/contrats', label: 'Contrats', Icon: FileText },
  { href: '/rh/paie', label: 'Paie', Icon: Wallet },
  { href: '/rh/conges', label: 'Congés', Icon: Palmtree },
  { href: '/rh/evaluations', label: 'Évaluations', Icon: ClipboardCheck },
  { href: '/rh/parametres', label: 'Paramètres', Icon: Settings },
]

export default function RHNav({ role }: { role?: string } = {}) {
  const TABS = ['de', 'dp', 'administrateur'].includes(role ?? '')
    ? ALL_TABS.filter(t => t.href === '/rh/conges')
    : ALL_TABS
  return <SectionSideNav items={TABS} />
}
