'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Target } from 'lucide-react'

// Sous-onglets de "Vue d'ensemble" : le contenu opérationnel existant, et le
// registre BD en lecture seule (auparavant un menu BD séparé pour le DE et
// les autres superviseurs — désormais regroupé ici, sous Vue d'ensemble,
// pour tous les rôles qui y ont accès).
//
// Style volontairement plus léger (onglets soulignés) que les barres en
// pilules déjà utilisées pour la sous-navigation de chaque module (BDNav,
// DENav, AAFNav...) — cette barre-ci désigne un niveau au-dessus (quelle
// zone), pas un onglet parmi d'autres au même niveau ; empiler deux barres
// en pilules identiques aurait rendu la hiérarchie illisible.
const TABS = [
  { href: '/overview', label: "Vue d'ensemble des opérations", icon: LayoutGrid },
  { href: '/bd', label: 'BD', icon: Target },
]

export default function OverviewSubNav() {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', gap: 26, borderBottom: '1px solid #e5e7eb' }}>
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        const Icon = tab.icon
        return (
          <Link key={tab.href} href={tab.href} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '0 2px 12px', fontSize: 13.5, fontWeight: active ? 700 : 500,
            color: active ? 'var(--abed-green)' : '#6b7280',
            borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
            textDecoration: 'none', marginBottom: -1,
          }}>
            <Icon size={15} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
