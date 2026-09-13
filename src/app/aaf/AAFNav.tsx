'use client'
import { LayoutDashboard, Eye, Wallet, ClipboardList, Scale, Banknote } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

export default function AAFNav({ role }: { role?: string }) {
  // Vue d'ensemble et Pay Roll ne sont des sous-menus ici que pour l'AAF
  // seul(e) — la CAF a déjà sa propre Vue d'ensemble et son propre Pay Roll
  // (bien plus complet) ailleurs ; les répéter ici serait redondant et ferait
  // croire à tort que ces écrans appartiennent au menu AAF pour elle aussi.
  const TABS = [
    { href: '/aaf', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
    ...(role === 'aaf' ? [{ href: '/overview', label: "Vue d'ensemble", exact: true, Icon: Eye }] : []),
    { href: '/aaf/demandes-paiement', label: 'Demandes de paiement', Icon: Wallet },
    { href: '/aaf/rapports-allocations', label: "Rapports d'allocation", Icon: ClipboardList },
    { href: '/aaf/reconciliations', label: 'Réconciliations OM', Icon: Scale },
    ...(role === 'aaf' ? [{ href: '/aaf/pay-roll', label: 'Pay Roll', Icon: Banknote }] : []),
  ]
  return <SectionSideNav items={TABS} />
}
