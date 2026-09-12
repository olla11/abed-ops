'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SideNavItem =
  // Navigation classique (changement de route) — actif déterminé par l'URL.
  | { kind?: 'link'; href: string; label: string; Icon: LucideIcon; exact?: boolean; badge?: number }
  // Bascule d'onglet en JS, sans changer de route (ex. TdR : Mes TdR / À
  // signer / ...) — actif fourni par l'appelant, pas déduit de l'URL.
  | { kind: 'button'; key: string; label: string; Icon: LucideIcon; active: boolean; onClick: () => void; badge?: number }
  // Simple étiquette de regroupement (ex. "Doc & Sign") insérée entre des
  // items "link" — pas de navigation propre, disparaît quand le menu est
  // replié (ses items suivants restent, eux, navigables par leur icône).
  | { kind: 'heading'; label: string }

// Repli persistant, partagé entre toutes les sections (Admin, RH, DE, CAF,
// BD, AAF, Mon espace, TdR...) — l'utilisateur qui replie le menu une fois
// s'attend à le retrouver replié partout, pas seulement là où il l'a fait.
const STORAGE_KEY = 'abed-sidenav-collapsed'

// Barre de navigation verticale repliable pour les sous-menus d'une section
// (remplace l'ancienne rangée horizontale de pastilles). Repliée, seules les
// icônes restent visibles (avec le libellé en info-bulle) ; sous 700px, elle
// repasse en rangée horizontale qui s'enroule, pour rester utilisable sur
// petit écran sans réintroduire un défilement horizontal caché.
export default function SectionSideNav({ items, title }: { items: SideNavItem[]; title?: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1') } catch { /* localStorage indisponible */ }
    setReady(true)
  }, [])

  function toggle() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* localStorage indisponible */ }
      return next
    })
  }

  return (
    <nav className={`sidenav${collapsed ? ' sidenav-collapsed' : ''}`} style={{ visibility: ready ? 'visible' : 'hidden' }}>
      <style>{`
        .sidenav { width: 216px; flex-shrink: 0; background: #f9fafb; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 2px; transition: width .15s ease; align-self: flex-start; }
        .sidenav-collapsed { width: 54px; }
        .sidenav-toggle { display: flex; align-items: center; justify-content: center; width: 100%; padding: 8px 0; border: none; background: none; cursor: pointer; color: #9ca3af; border-radius: 8px; margin-bottom: 6px; }
        .sidenav-toggle:hover { background: #eef1ea; color: #374151; }
        .sidenav-title, .sidenav-heading { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #9ca3af; padding: 4px 10px 10px; white-space: nowrap; }
        .sidenav-heading { margin-top: 6px; }
        .sidenav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; text-decoration: none; font-size: 13.5px; font-weight: 500; color: #374151; white-space: nowrap; overflow: hidden; border: none; background: none; cursor: pointer; width: 100%; text-align: left; font-family: inherit; }
        .sidenav-item.active { background: var(--abed-green); color: white; font-weight: 700; }
        .sidenav-item:not(.active):hover { background: #eef1ea; }
        .sidenav-label { overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .sidenav-collapsed .sidenav-label, .sidenav-collapsed .sidenav-title, .sidenav-collapsed .sidenav-heading { display: none; }
        .sidenav-badge { font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 20px; background: #ef4444; color: white; flex-shrink: 0; }
        .sidenav-item.active .sidenav-badge { background: rgba(255,255,255,.3); }
        @media (max-width: 700px) {
          .sidenav, .sidenav-collapsed { width: 100%; flex-direction: row; flex-wrap: wrap; }
          .sidenav-toggle, .sidenav-title, .sidenav-heading { display: none; }
          .sidenav-collapsed .sidenav-label { display: inline; }
          .sidenav-item { flex: 0 0 auto; width: auto; }
        }
      `}</style>
      <button className="sidenav-toggle" onClick={toggle} title={collapsed ? 'Déplier le menu' : 'Replier le menu'}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      {title && <div className="sidenav-title">{title}</div>}
      {items.map((item, i) => {
        if (item.kind === 'heading') {
          return <div key={`h-${i}`} className="sidenav-heading">{item.label}</div>
        }
        if (item.kind === 'button') {
          return (
            <button key={item.key} onClick={item.onClick} className={`sidenav-item${item.active ? ' active' : ''}`} title={item.label}>
              <item.Icon size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span className="sidenav-label">{item.label}</span>
              {!!item.badge && <span className="sidenav-badge">{item.badge}</span>}
            </button>
          )
        }
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} className={`sidenav-item${active ? ' active' : ''}`} title={item.label}>
            <item.Icon size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <span className="sidenav-label">{item.label}</span>
            {!!item.badge && <span className="sidenav-badge">{item.badge}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
