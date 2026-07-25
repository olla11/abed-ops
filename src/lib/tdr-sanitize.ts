import sanitizeHtml from 'sanitize-html'
import type { Chapitre } from './tdr'

// Le contenu des chapitres "texte" vient d'un éditeur riche (gras/italique/
// souligné/lien/tableau) : on nettoie le HTML à l'écriture ET à l'affichage
// PDF, pour empêcher toute injection de script par un collaborateur en révision.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
  allowedAttributes: { a: ['href', 'target', 'rel'], p: ['style'], span: ['data-comment-id'] },
  allowedClasses: { span: ['tdr-comment-highlight'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedStyles: {
    p: { 'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/] },
  },
}

export function sanitizeChapitreTexte(texte: string | undefined): string {
  if (!texte) return ''
  return sanitizeHtml(texte, OPTIONS)
}

export function sanitizeChapitres(chapitres: Chapitre[]): Chapitre[] {
  return chapitres.map(c => c.texte !== undefined ? { ...c, texte: sanitizeChapitreTexte(c.texte) } : c)
}
