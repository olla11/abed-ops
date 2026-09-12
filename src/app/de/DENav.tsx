'use client'
import { LayoutDashboard, FileSignature, Wallet, ClipboardList, Scale, Clock } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

const TABS = [
  { href: '/de', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
  { href: '/de/om-a-signer', label: 'OM à signer', Icon: FileSignature },
  { href: '/de/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
  { href: '/de/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
  { href: '/de/reconciliations', label: 'Réconciliations OM', Icon: Scale },
  { href: '/de/timesheets', label: 'Timesheets', Icon: Clock },
]

export default function DENav() {
  return <SectionSideNav items={TABS} />
}
