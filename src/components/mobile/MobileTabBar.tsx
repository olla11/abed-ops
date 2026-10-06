'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plane, Wallet, Menu, FileSignature, LayoutGrid, Scale, Landmark, Users, Palmtree, Settings, Target, type LucideIcon } from 'lucide-react'
import { estBD } from '@/lib/roles'

type Tab = { href: string; label: string; Icon: LucideIcon; match: string[] }

const ACCUEIL: Tab = { href: '/accueil', label: 'Accueil', Icon: Home, match: ['/accueil'] }
const MISSIONS: Tab = { href: '/dashboard', label: 'Missions', Icon: Plane, match: ['/dashboard', '/missions'] }
const PAIEMENTS: Tab = { href: '/demandes', label: 'Paiements', Icon: Wallet, match: ['/demandes'] }
const OVERVIEW: Tab = { href: '/overview', label: "Vue d'ens.", Icon: LayoutGrid, match: ['/overview'] }

// Deux onglets "métier" par rôle, entre Accueil et Menu — ce que la personne
// traite le plus souvent. Tout le reste reste accessible via "Menu".
export function tabsForRole(role?: string, titre?: string | null): Tab[] {
  if (estBD(titre)) return [ACCUEIL, { href: '/bd', label: 'BD', Icon: Target, match: ['/bd'] }, MISSIONS]
  switch (role) {
    case 'de':
      return [ACCUEIL,
        { href: '/de/om-a-signer', label: 'OM à signer', Icon: FileSignature, match: ['/de/om-a-signer'] },
        { href: '/de/demandes-paiement', label: 'Paiements', Icon: Wallet, match: ['/de/demandes-paiement'] }]
    case 'dp':
      return [ACCUEIL, OVERVIEW, MISSIONS]
    case 'aaf':
      return [ACCUEIL,
        { href: '/aaf/demandes-paiement', label: 'Paiements', Icon: Wallet, match: ['/aaf/demandes-paiement'] },
        { href: '/aaf/reconciliations', label: 'Réconcil.', Icon: Scale, match: ['/aaf/reconciliations'] }]
    case 'caf':
      return [ACCUEIL,
        { href: '/caf', label: 'CAF Pro', Icon: Landmark, match: ['/caf'] },
        { href: '/caf/demandes-paiement', label: 'Paiements', Icon: Wallet, match: ['/caf/demandes-paiement'] }]
    case 'rh':
      return [ACCUEIL,
        { href: '/rh', label: 'RH', Icon: Users, match: ['/rh'] },
        { href: '/rh/conges', label: 'Congés', Icon: Palmtree, match: ['/rh/conges'] }]
    case 'administrateur':
      return [ACCUEIL, OVERVIEW, MISSIONS]
    case 'admin':
    case 'superadmin':
      return [ACCUEIL, OVERVIEW, { href: '/admin', label: 'Admin', Icon: Settings, match: ['/admin'] }]
    default:
      return [ACCUEIL, MISSIONS, PAIEMENTS]
  }
}

export default function MobileTabBar({ role, titre, menuOpen, onMenu }: { role?: string; titre?: string | null; menuOpen: boolean; onMenu: () => void }) {
  const pathname = usePathname()
  const tabs = tabsForRole(role, titre)

  // Le plus long préfixe gagne : /caf/demandes-paiement allume "Paiements",
  // pas "CAF Pro" (/caf).
  const best = tabs
    .flatMap(t => t.match.filter(m => pathname === m || pathname.startsWith(m + '/')).map(m => ({ href: t.href, len: m.length })))
    .sort((a, b) => b.len - a.len)[0]?.href

  return (
    <nav className="mobile-tabbar" aria-label="Navigation mobile">
      {tabs.map(t => {
        const active = !menuOpen && best === t.href
        return (
          <Link key={t.href} href={t.href} className={`mobile-tabbar-item${active ? ' active' : ''}`}>
            <t.Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
            <span>{t.label}</span>
          </Link>
        )
      })}
      <button type="button" className={`mobile-tabbar-item${menuOpen ? ' active' : ''}`} onClick={onMenu}>
        <Menu size={21} strokeWidth={menuOpen ? 2.2 : 1.7} />
        <span>Menu</span>
      </button>
    </nav>
  )
}
