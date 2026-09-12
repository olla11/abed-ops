'use client'
import { LayoutDashboard, Calendar, Target, FileBarChart, LayoutGrid } from 'lucide-react'
import SectionSideNav, { type SideNavItem } from '@/components/SectionSideNav'

const TABS_BASE: SideNavItem[] = [
  { href: '/bd', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
  { href: '/bd/calendrier', label: 'Calendrier', Icon: Calendar },
  { href: '/bd/opportunites', label: 'Opportunités', Icon: Target },
]

// "Rapport" est un outil de travail de l'équipe BD — pas partagé avec les
// superviseurs qui consultent /bd en lecture seule depuis Vue d'ensemble.
// Pour ces superviseurs, "Vue d'ensemble des opérations" (d'où ils viennent)
// est ajouté en tête — auparavant une barre d'onglets séparée (OverviewSubNav)
// au-dessus de ce menu, désormais fondue dans la même barre verticale.
export default function BDNav({ estEquipeBD }: { estEquipeBD: boolean }) {
  const TABS: SideNavItem[] = estEquipeBD
    ? [...TABS_BASE, { href: '/bd/rapport', label: 'Rapport', Icon: FileBarChart }]
    : [
        { href: '/overview', label: "Vue d'ensemble des opérations", Icon: LayoutGrid },
        { kind: 'heading', label: 'BD' },
        ...TABS_BASE,
      ]
  return <SectionSideNav items={TABS} />
}
