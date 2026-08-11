import type { Titre } from './roles'

// Politique de rémunération PG N° 002-25/DE-ABED ONG (adoptée par le CA le
// 31 juillet 2026) — niveau de fonction utilisé pour les barèmes
// (honoraires, allocations bénévoles) et l'ancienneté (Sénior/Medium/
// Junior) là où le barème le prévoit.

export const NIVEAUX_FONCTION_HONORAIRE = [
  'directeur', 'programme_lead_manager', 'charge_projet', 'agent_projet',
  'animateur', 'assistant', 'conducteur', 'agent_entretien',
] as const
export type NiveauFonctionHonoraire = (typeof NIVEAUX_FONCTION_HONORAIRE)[number]

export const NIVEAU_FONCTION_LABELS: Record<NiveauFonctionHonoraire, string> = {
  directeur: 'Directeurs (Exécutif, Directions principales)',
  programme_lead_manager: 'Programme Lead / Manager',
  charge_projet: 'Chargé de Projet / opérations',
  agent_projet: "Agent de projet (chargé d'accompagnement, superviseur)",
  animateur: 'Animateurs de terrain, Coachs, conseiller, facilitateur',
  assistant: 'Assistants (administration)',
  conducteur: 'Conducteur de véhicule administratif',
  agent_entretien: "Agent d'entretien / sécurité / coursier",
}

export const SENIORITES = ['senior', 'medium', 'junior'] as const
export type Seniorite = (typeof SENIORITES)[number]
export const SENIORITE_LABELS: Record<Seniorite, string> = {
  senior: 'Sénior', medium: 'Medium', junior: 'Junior',
}

// Titres qui prévoient une distinction Sénior/Medium/Junior dans le barème.
export const NIVEAUX_AVEC_SENIORITE: NiveauFonctionHonoraire[] = ['programme_lead_manager', 'charge_projet']

// Titre (poste RH) -> niveau de fonction pour les barèmes. Certains titres
// n'ont pas d'équivalent dans la politique de rémunération (CAF/AAF/RH sont
// des fonctions salariées propres, pas des "postes de prestation" au sens
// du Tableau 2/Tableau 1) — le barème ne s'applique alors pas et le calcul
// retombe sur les anciens taux plats de configuration.
export const TITRE_VERS_NIVEAU_FONCTION: Partial<Record<Titre, NiveauFonctionHonoraire>> = {
  directeur_executif: 'directeur',
  directeur_programmes: 'directeur',
  directeur_principal: 'directeur',
  representant_pays: 'programme_lead_manager',
  programme_lead: 'programme_lead_manager',
  responsable_communication: 'programme_lead_manager',
  charge_projet: 'charge_projet',
  agent_projet: 'agent_projet',
  animateur: 'animateur',
  assistant_communication: 'assistant',
  assistant_admin: 'assistant',
  conducteur: 'conducteur',
  agent_entretien: 'agent_entretien',
}

export function getNiveauFonction(titre: string | null | undefined): NiveauFonctionHonoraire | null {
  if (!titre) return null
  return TITRE_VERS_NIVEAU_FONCTION[titre as Titre] ?? null
}
