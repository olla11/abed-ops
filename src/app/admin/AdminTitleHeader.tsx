'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

// Titre de page, séparé de AdminNav (qui ne rend plus que le sous-menu
// latéral) — ce bandeau doit occuper toute la largeur, au-dessus du menu et
// du contenu, pas seulement au-dessus de la colonne du menu.
export default function AdminTitleHeader() {
  const ta = useTranslations('admin')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← {ta('title')}</Link>
      <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>{ta('title')}</h2>
    </div>
  )
}
