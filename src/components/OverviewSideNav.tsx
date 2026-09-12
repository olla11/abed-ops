'use client'
import SectionSideNav from '@/components/SectionSideNav'
import { OVERVIEW_NAV_ITEMS } from '@/components/overviewNavItems'

// Wrapper client : OVERVIEW_NAV_ITEMS contient des composants Icon
// (fonctions), qui ne peuvent pas être sérialisés en traversant la
// frontière Server -> Client Component. En les résolvant ici, côté client,
// overview/page.tsx (Server Component) n'a plus qu'à rendre ce composant
// sans lui passer les items directement.
export default function OverviewSideNav() {
  return <SectionSideNav items={OVERVIEW_NAV_ITEMS} />
}
