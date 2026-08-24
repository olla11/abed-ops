// Registre des opportunités de financement (menu /bd, Business Developer).
// Statut unifié couvrant tout le cycle : identification -> préparation ->
// soumission -> réponse du bailleur — remplace les deux colonnes séparées
// (Statut / Réponse du bailleur) du registre Excel d'origine.

export const TYPE_OPPORTUNITE_LABELS = {
  appel_a_projets: 'Appel à Projets',
  ami: "AMI (Avis de Manifestation d'Intérêt)",
} as const
export type TypeOpportunite = keyof typeof TYPE_OPPORTUNITE_LABELS

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

