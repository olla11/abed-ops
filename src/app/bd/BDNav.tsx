'use client'
import { LayoutDashboard, Calendar, Target, FileBarChart } from 'lucide-react'
import SectionSideNav from '@/components/SectionSideNav'

const TABS_BASE = [
  { href: '/bd', label: 'Tableau de bord', exact: true, Icon: LayoutDashboard },
  { href: '/bd/calendrier', label: 'Calendrier', Icon: Calendar },
  { href: '/bd/opportunites', label: 'Opportunités', Icon: Target },
]

// "Rapport" est un outil de travail de l'équipe BD — pas partagé avec les
// superviseurs qui consultent /bd en lecture seule depuis Vue d'ensemble.
export default function BDNav({ estEquipeBD }: { estEquipeBD: boolean }) {
  const TABS = estEquipeBD ? [...TABS_BASE, { href: '/bd/rapport', label: 'Rapport', Icon: FileBarChart }] : TABS_BASE
  return <SectionSideNav items={TABS} />
}
