'use client'
import { LayoutDashboard, Eye, Wallet, ClipboardList, Scale, Banknote, FileText } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

export default function AAFNav({ role }: { role?: string }) {
  // Vue d'ensemble et Bon de commande ne restent des sous-menus ici que pour
  // l'AAF seul(e) : Vue d'ensemble parce que la CAF a déjà la sienne
  // ailleurs, Bon de commande parce que seule l'AAF peut en émettre. Pay
  // Roll en revanche apparaît aussi pour la CAF, qui hérite du reste du menu
  // AAF (elle peut agir à sa place) — ce Pay Roll AAF (marquer payé une fois
  // l'appel de fonds signé) est une action distincte du Pay Roll CAF Pro.
  const TABS = [
    { href: '/aaf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
    ...(role === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", exact: true, Icon: Eye }] : []),
    { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
    { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
    { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
    { href: '/aaf/pay-roll', label: 'Pay Roll', Icon: Banknote },
    ...(role === 'aaf' ? [{ href: '/aaf/bons-de-commande', label: 'Bon de commande', Icon: FileText }] : []),
  ]
  return <SectionSideNav items={TABS} />
}
