/**
 * Formate un nom pour affichage en signature manuscrite (police cursive) :
 * seul le premier prénom est conservé (capitalisé), le nom de famille est en minuscules.
 * Ex: ("Jean Paul", "DUPONT") → "Jean dupont"
 */
export function formatSignatureDisplayName(prenoms: string | null | undefined, nom: string | null | undefined): string {
  const firstPrenom = (prenoms ?? '').trim().split(/\s+/)[0] ?? ''
  const capPrenom = firstPrenom
    ? firstPrenom.charAt(0).toUpperCase() + firstPrenom.slice(1).toLowerCase()
    : ''
  const nomLower = (nom ?? '').trim().toLowerCase()
  return `${capPrenom} ${nomLower}`.trim()
}
