import { LayoutGrid, Target } from 'lucide-react'
import type { SideNavItem } from './SectionSideNav'

// Partagé entre /overview (page principale) et /bd (accès superviseur en
// lecture seule) — le registre BD a quitté son propre menu principal pour
// devenir un sous-item de "Vue d'ensemble" pour ces rôles (voir
// SHOW_BD_SUBTAB_ROLES dans overview/page.tsx).
export const OVERVIEW_NAV_ITEMS: SideNavItem[] = [
  { href: '/overview', label: "Vue d'ensemble des opérations", Icon: LayoutGrid, exact: true },
  { href: '/bd', label: 'BD', Icon: Target },
]
