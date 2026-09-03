// Enregistrement de présence des visiteurs — types partagés entre le
// formulaire public (/presence/[slug]) et l'administration (/admin/presence).

export type PresenceQuestionType = 'texte' | 'choix' | 'email' | 'telephone'

export type PresenceQuestion = {
  id: string
  label: string
  type: PresenceQuestionType
  requis: boolean
  options?: string[] // uniquement pour le type "choix"
}

export const MOTIFS_DEFAUT = ['Rendez-vous', 'Visite', 'Mémoire', 'Autre']

export function genererSlug(): string {
  return Math.random().toString(36).slice(2, 10)
}

// Slug : minuscules, chiffres, tirets — lisible dans une URL et facile à
// personnaliser à la main (ex. "accueil-abed") sans risque d'ambiguïté.
const SLUG_RE = /^[a-z0-9-]{3,50}$/

export function slugValide(slug: string): boolean {
  return SLUG_RE.test(slug)
}
