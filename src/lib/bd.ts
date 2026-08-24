// Registre des opportunités de financement (menu /bd, Business Developer).
// Statut unifié couvrant tout le cycle : identification -> préparation ->
// soumission -> réponse du bailleur — remplace les deux colonnes séparées
// (Statut / Réponse du bailleur) du registre Excel d'origine.

export const OPPORTUNITE_STATUTS = [
  'identifie', 'en_preparation', 'soumis', 'accepte', 'refuse', 'sans_reponse', 'abandonne',
] as const
export type OpportuniteStatut = (typeof OPPORTUNITE_STATUTS)[number]

export const STATUT_LABELS: Record<OpportuniteStatut, string> = {
  identifie: 'Identifiée',
  en_preparation: 'En préparation',
  soumis: 'Soumise',
  accepte: 'Acceptée',
  refuse: 'Refusée',
  sans_reponse: 'Sans réponse',
  abandonne: 'Abandonnée',
}

export const STATUT_COLORS: Record<OpportuniteStatut, string> = {
  identifie: '#6b7280',
  en_preparation: '#b45309',
  soumis: '#1e40af',
  accepte: '#166534',
  refuse: '#991b1b',
  sans_reponse: '#78716c',
  abandonne: '#57534e',
}

// Statuts considérés "résolus" (le dossier ne bouge plus) — pour les
// compteurs du tableau de bord (réponses reçues, taux de succès, etc.).
export const STATUTS_TERMINES: OpportuniteStatut[] = ['accepte', 'refuse', 'sans_reponse', 'abandonne']
export const STATUTS_EN_PREPARATION: OpportuniteStatut[] = ['identifie', 'en_preparation']

export type CalendrierBucket = 'a_faire' | 'en_retard' | 'en_attente' | 'termine'

export const CALENDRIER_BUCKET_LABELS: Record<CalendrierBucket, string> = {
  a_faire: 'À faire',
  en_retard: 'En retard',
  en_attente: 'Soumis — en attente',
  termine: 'Terminé',
}

export const CALENDRIER_BUCKET_COLORS: Record<CalendrierBucket, string> = {
  a_faire: '#1e40af',
  en_retard: '#991b1b',
  en_attente: '#b45309',
  termine: '#166534',
}

/**
 * Classe une opportunité dans l'une des 4 catégories du calendrier BD.
 * "En retard" : encore en préparation (jamais soumise) alors que la date
 * limite est dépassée. Une fois soumise, la date limite n'a plus d'effet.
 */
export function calendrierBucket(statut: OpportuniteStatut, dateLimite: string | null): CalendrierBucket {
  if (STATUTS_EN_PREPARATION.includes(statut)) {
    if (dateLimite) {
      const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0)
      const limite = new Date(dateLimite)
      if (limite < aujourdhui) return 'en_retard'
    }
    return 'a_faire'
  }
  if (statut === 'soumis') return 'en_attente'
  return 'termine'
}
