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

// "Délai dépassé" n'est pas un statut stocké en base : c'est une
// classification automatique — une opportunité encore identifiée/en
// préparation dont la date limite est passée sans soumission. Elle prend
// la place de son statut brut partout où le statut est affiché ou filtré.
export const DELAI_DEPASSE_LABEL = 'Délai dépassé'
export const DELAI_DEPASSE_COLOR = '#c2410c'

export function estDelaiDepasse(o: { statut: OpportuniteStatut; date_limite: string | null }): boolean {
  if (!o.date_limite || !STATUTS_EN_PREPARATION.includes(o.statut)) return false
  const limite = new Date(o.date_limite); limite.setHours(0, 0, 0, 0)
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0)
  return limite.getTime() < aujourdhui.getTime()
}

export function statutAffiche(o: { statut: OpportuniteStatut; date_limite: string | null }): { label: string; color: string } {
  if (estDelaiDepasse(o)) return { label: DELAI_DEPASSE_LABEL, color: DELAI_DEPASSE_COLOR }
  return { label: STATUT_LABELS[o.statut], color: STATUT_COLORS[o.statut] }
}

