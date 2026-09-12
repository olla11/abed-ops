'use client'
import { LayoutDashboard, Eye, Wallet, ClipboardList, Scale } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

export default function AAFNav({ role }: { role?: string }) {
  // Vue d'ensemble n'est un sous-menu ici que pour l'AAF seul(e) — la CAF (et
  // l'admin) l'ont déjà comme onglet principal indépendant, la répéter ici
  // serait redondant et fait croire à tort qu'elle appartient au menu AAF.
  const TABS = [
    { href: '/aaf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
    ...(role === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", exact: true, Icon: Eye }] : []),
    { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
    { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
    { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
  ]
  return <SectionSideNav items={TABS} />
}
