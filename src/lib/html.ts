// Échappe les caractères spéciaux HTML pour empêcher l'injection de balises
// lorsqu'on interpole du contenu fourni par l'utilisateur dans un email HTML.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
