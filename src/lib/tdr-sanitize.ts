import sanitizeHtml from 'sanitize-html'
import type { Chapitre } from './tdr'

// Le contenu des chapitres "texte" vient d'un éditeur riche (gras/italique/
// souligné/lien/tableau) : on nettoie le HTML à l'écriture ET à l'affichage
// PDF, pour empêcher toute injection de script par un collaborateur en révision.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
}

export function sanitizeChapitreTexte(texte: string | undefined): string {
  if (!texte) return ''
  return sanitizeHtml(texte, OPTIONS)
}

export function sanitizeChapitres(chapitres: Chapitre[]): Chapitre[] {
  return chapitres.map(c => c.type === 'texte' ? { ...c, texte: sanitizeChapitreTexte(c.texte) } : c)
}
