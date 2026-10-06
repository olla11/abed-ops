'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export type MenuItem = { href: string; label: string; Icon: LucideIcon; active?: boolean }
export type MenuGroup = { title: string; items: MenuItem[] }

// Menu plein écran (onglet "Menu" de la barre du bas) — remplace l'ancien
// menu déroulant mobile d'AppHeader. Mêmes destinations, regroupées par
// section, avec icônes Lucide et cibles tactiles de 48px.
export default function MobileMenuSheet({ open, onClose, userName, roleLabel, groups }: {
  open: boolean; onClose: () => void; userName?: string; roleLabel?: string; groups: MenuGroup[]
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  const initials = (userName ?? '').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="mobile-menu-sheet" role="dialog" aria-label="Menu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px', background: '#fff', borderBottom: '1px solid var(--abed-border)', marginBottom: 6 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--abed-blue)', color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials || '?'}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          {roleLabel && <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{roleLabel}</div>}
        </div>
      </div>

      {groups.filter(g => g.items.length > 0).map(g => (
        <div key={g.title} style={{ marginBottom: 6 }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: 'var(--abed-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{g.title}</div>
          {g.items.map(it => (
            <Link key={g.title + it.href} href={it.href} onClick={onClose} className={`mobile-menu-item${it.active ? ' active' : ''}`}>
              <it.Icon size={18} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{it.label}</span>
              <ChevronRight size={16} color="#9ca3af" />
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
