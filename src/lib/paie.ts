// Calcul de la paie (CNSS + ITS) à partir des paramètres RH éditables
// (voir /rh/parametres et /api/rh/parametres-paie). Fonctions pures pour
// rester testables indépendamment de la base de données.

export type TrancheITS = { jusqua: number | null; taux: number }

export function calculerCNSS(salaireBrut: number, tauxPourcent: number): number {
  return Math.round(salaireBrut * (tauxPourcent / 100))
}

// Barème progressif : chaque tranche s'applique uniquement à la portion du
// salaire comprise entre la borne précédente et la sienne (comme un barème
// d'impôt sur le revenu classique), pas au salaire total.
export function calculerITS(salaireBrut: number, bareme: TrancheITS[]): number {
  let impot = 0
  let borneBasse = 0
  for (const tranche of bareme) {
    const borneHaute = tranche.jusqua ?? Infinity
    if (salaireBrut <= borneBasse) break
    const portion = Math.min(salaireBrut, borneHaute) - borneBasse
    if (portion > 0) impot += portion * (tranche.taux / 100)
    borneBasse = borneHaute
    if (salaireBrut <= borneHaute) break
  }
  return Math.round(impot)
}

export function calculerFichePaie(salaireBrut: number, tauxCnss: number, bareme: TrancheITS[]) {
  const cnss = calculerCNSS(salaireBrut, tauxCnss)
  const its = calculerITS(salaireBrut, bareme)
  const retenues = cnss + its
  return { salaireBrut, cnss, its, retenues, salaireNet: salaireBrut - retenues }
}
