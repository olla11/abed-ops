'use client'
import { LayoutDashboard, Wallet, ClipboardList, Scale, Clock } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

const TABS = [
  { href: '/caf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
  { href: '/caf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
  { href: '/caf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
  { href: '/caf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
  { href: '/caf/timesheets', label: 'Timesheets & paiements', Icon: Clock },
]

export default function CAFNav() {
  return <SectionSideNav items={TABS} />
}
