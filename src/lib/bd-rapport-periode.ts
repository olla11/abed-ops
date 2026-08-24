// Résolution d'une période (mois ou trimestre + année) en plage de dates —
// partagée entre l'aperçu JSON et la génération du PDF du rapport BD.

export const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export type PeriodeResolue = {
  dateDebut: string
  dateFin: string
  periodeLabel: string
  periodeType: 'Mensuel' | 'Trimestriel'
  slug: string
}

function pad2(n: number) { return String(n).padStart(2, '0') }
function dernierJour(annee: number, moisIndex1: number) { return new Date(annee, moisIndex1, 0).getDate() }

export function resoudrePeriode(type: string | null, annee: number, mois: number | null, trimestre: number | null): PeriodeResolue | null {
  if (!annee || !['mensuel', 'trimestriel'].includes(type ?? '')) return null

  let moisDebut1: number, moisFin1: number, periodeLabel: string, periodeType: 'Mensuel' | 'Trimestriel', slug: string

  if (type === 'mensuel') {
    if (!mois || mois < 1 || mois > 12) return null
    moisDebut1 = mois; moisFin1 = mois
    periodeLabel = `${MOIS_LABELS[mois - 1]} ${annee}`
    periodeType = 'Mensuel'
    slug = `${annee}-${pad2(mois)}`
  } else {
    if (!trimestre || trimestre < 1 || trimestre > 4) return null
    moisDebut1 = (trimestre - 1) * 3 + 1
    moisFin1 = moisDebut1 + 2
    periodeLabel = `T${trimestre} ${annee} (${MOIS_LABELS[moisDebut1 - 1]} à ${MOIS_LABELS[moisFin1 - 1]})`
    periodeType = 'Trimestriel'
    slug = `${annee}-T${trimestre}`
  }

  return {
    dateDebut: `${annee}-${pad2(moisDebut1)}-01`,
    dateFin: `${annee}-${pad2(moisFin1)}-${pad2(dernierJour(annee, moisFin1))}`,
    periodeLabel, periodeType, slug,
  }
}
