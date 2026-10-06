'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Sur mobile, globals.css transforme chaque ligne de <table> en carte
// (comme les listes du prototype). Pour que chaque valeur garde son
// intitulé, on recopie le texte de l'en-tête <th> dans data-label sur
// chaque <td> — sur TOUTES les pages, sans modifier chaque tableau.
// Un tableau peut s'exclure avec className="no-mobile-cards".
function label(root: ParentNode) {
  root.querySelectorAll('table:not(.no-mobile-cards)').forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent ?? '').trim())
    if (!heads.length) return
    table.querySelectorAll('tbody tr').forEach(tr => {
      let col = 0
      Array.from(tr.children).forEach(cell => {
        const td = cell as HTMLTableCellElement
        const h = heads[col] ?? ''
        if (td.getAttribute('data-label') !== h) td.setAttribute('data-label', h)
        col += td.colSpan || 1
      })
    })
  })
}

export default function MobileTableCards() {
  const pathname = usePathname()
  useEffect(() => {
    label(document)
    let raf = 0
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => label(document))
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => { obs.disconnect(); cancelAnimationFrame(raf) }
  }, [pathname])
  return null
}
