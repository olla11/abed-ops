'use client'
import { LayoutDashboard, Eye, Wallet, ClipboardList, Scale, Banknote, FileText } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

export default function AAFNav({ role }: { role?: string }) {
  // Seule Vue d'ensemble reste un sous-menu propre à l'AAF — la CAF a déjà
  // la sienne ailleurs, la répéter ici serait redondant. Tout le reste du
  // menu AAF (y compris Pay Roll et Bon de commande) est hérité intégralement
  // par la CAF, qui peut agir à sa place sur chaque écran.
  const TABS = [
    { href: '/aaf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
    ...(role === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", exact: true, Icon: Eye }] : []),
    { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
    { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
    { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
    { href: '/aaf/pay-roll', label: 'Pay Roll', Icon: Banknote },
    { href: '/aaf/bons-de-commande', label: 'Bon de commande', Icon: FileText },
  ]
  return <SectionSideNav items={TABS} />
}
