'use client'
import { LayoutDashboard, Eye, Wallet, ClipboardList, Scale, Banknote } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

export default function AAFNav({ role }: { role?: string }) {
  // Vue d'ensemble ne reste un sous-menu ici que pour l'AAF seul(e) — la CAF
  // a déjà sa propre Vue d'ensemble ailleurs, la répéter ici serait
  // redondant. Pay Roll en revanche doit apparaître pour la CAF aussi : la
  // CAF hérite de tout le menu AAF (elle peut agir à sa place), et ce
  // Pay Roll AAF (marquer payé une fois l'appel de fonds signé) est une
  // action distincte du Pay Roll CAF Pro (bien plus complet, en amont).
  const TABS = [
    { href: '/aaf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
    ...(role === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", exact: true, Icon: Eye }] : []),
    { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
    { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
    { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
    { href: '/aaf/pay-roll', label: 'Pay Roll', Icon: Banknote },
  ]
  return <SectionSideNav items={TABS} />
}
