// Conversion d'un entier en toutes lettres françaises — utilisé pour la
// mention "Arrêté la présente demande à la somme de ... francs CFA" sur
// l'appel de fonds (voir src/lib/appel-de-fonds-pdf.ts).

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
// Index par dizaine (2=vingt … 9=quatre-vingt-dix) ; 7 et 9 sont gérés à part
// (soixante-dix, quatre-vingt-dix se construisent sur soixante/quatre-vingt).
const DIZAINES: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 8: 'quatre-vingt' }

function deuxChiffresEnLettres(n: number): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 7 || d === 9) {
    const base = DIZAINES[d - 1]
    return u === 1 ? `${base}-et-onze` : `${base}-${UNITES[10 + u]}`
  }
  if (d === 8) return u === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITES[u]}`
  if (u === 0) return DIZAINES[d]
  if (u === 1) return `${DIZAINES[d]}-et-un`
  return `${DIZAINES[d]}-${UNITES[u]}`
}

function troisChiffresEnLettres(n: number): string {
  if (n === 0) return ''
  const c = Math.floor(n / 100)
  const r = n % 100
  const mots: string[] = []
  if (c > 0) {
    mots.push(c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 ? 's' : ''}`)
  }
  if (r > 0) mots.push(deuxChiffresEnLettres(r))
  return mots.join(' ')
}

export function nombreEnLettresFr(valeur: number): string {
  const n = Math.round(Math.abs(valeur))
  if (n === 0) return 'zéro'

  let reste = n
  const milliards = Math.floor(reste / 1_000_000_000); reste %= 1_000_000_000
  const millions = Math.floor(reste / 1_000_000); reste %= 1_000_000
  const milliers = Math.floor(reste / 1_000); reste %= 1_000
  const unites = reste

  const parts: string[] = []
  if (milliards > 0) parts.push(`${milliards === 1 ? '' : troisChiffresEnLettres(milliards) + ' '}milliard${milliards > 1 ? 's' : ''}`.trim())
  if (millions > 0) parts.push(`${millions === 1 ? '' : troisChiffresEnLettres(millions) + ' '}million${millions > 1 ? 's' : ''}`.trim())
  if (milliers > 0) parts.push(milliers === 1 ? 'mille' : `${troisChiffresEnLettres(milliers)} mille`)
  if (unites > 0) parts.push(troisChiffresEnLettres(unites))

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
