// =====================================================================
// ABED-ONG — Titres du personnel et niveaux d'accès
// =====================================================================
// Deux dimensions distinctes :
//   1. TITRE (poste réel)  -> issu des politiques RH & rémunération
//   2. ACCÈS (rôle système) -> droits dans l'application
// On attribue un titre ; le titre détermine l'accès.
// =====================================================================

// --- Types d'emploi (Politique de développement RH §1.5) ---
export const TYPES_EMPLOI = [
  'benevole',
  'stagiaire_n1',
  'stagiaire_n2',
  'prestataire_direct',
  'prestataire_credit',
  'cdd',
] as const
export type TypeEmploi = (typeof TYPES_EMPLOI)[number]

// --- Titres / fonctions (Politique de rémunération, Tableau 2) ---
export const TITRES = [
  'directeur_executif',          // DE
  'directeur_principal',         // Directions principales (Programmes, Exploitation...)
  'programme_lead',              // Programme Lead / Manager
  'charge_projet',               // Chargé de Projet / opérations
  'agent_projet',                // Agent de projet, chargé d'accompagnement, superviseur
  'animateur',                   // Animateurs terrain, coachs, conseillers, facilitateurs
  'caf',                         // Chargé Administration & Finances
  'aaf',                         // Assistant administratif et financier
  'assistant_admin',             // Assistants (administration)
  'rh',                          // Chargé des Ressources Humaines
  'conducteur',                  // Conducteur de véhicule administratif
  'agent_entretien',             // Agent d'entretien / sécurité / coursier
] as const
export type Titre = (typeof TITRES)[number]

export type AccessRole = 'missionnaire' | 'manager' | 'rh' | 'aaf' | 'caf' | 'de' | 'admin' | 'administrateur'

// --- Libellés lisibles ---
export const TITRE_LABELS: Record<Titre, string> = {
  directeur_executif: 'Directeur Exécutif',
  directeur_principal: 'Directeur principal',
  programme_lead: 'Programme Lead / Manager',
  charge_projet: 'Chargé de Projet / opérations',
  agent_projet: 'Agent de projet / superviseur',
  animateur: 'Animateur / Coach / Facilitateur',
  caf: 'Chargé Administration & Finances (CAF)',
  aaf: 'Assistant administratif et financier (AAF)',
  assistant_admin: 'Assistant administration',
  rh: 'Chargé des Ressources Humaines',
  conducteur: 'Conducteur véhicule',
  agent_entretien: "Agent d'entretien / sécurité / coursier",
  president_ca: "Président du Conseil d'Administration",
  secretaire_general_ca: "Secrétaire Général du Conseil d'Administration",
  tresorier_ca: "Trésorier Général du Conseil d'Administration",
}

export const TYPE_EMPLOI_LABELS: Record<TypeEmploi, string> = {
  benevole: 'Bénévole',
  stagiaire_n1: 'Stagiaire N1 (- 1 an exp.)',
  stagiaire_n2: 'Stagiaire N2 (1-2 ans exp.)',
  prestataire_direct: 'Prestataire direct (PD)',
  prestataire_credit: 'Prestataire à crédit (PC)',
  cdd: 'Contrat à durée déterminée (CDD)',
}

// --- Mapping TITRE -> niveau d'accès ---
// C'est ici que "le titre détermine les droits".
export const TITRE_TO_ACCESS: Record<Titre, AccessRole> = {
  directeur_executif: 'de',
  caf: 'caf',
  rh: 'rh',
  directeur_principal: 'manager',
  programme_lead: 'manager',
  charge_projet: 'manager',     // peut superviser des agents/prestataires
  agent_projet: 'missionnaire',
  animateur: 'missionnaire',
  aaf: 'aaf',
  assistant_admin: 'missionnaire',
  conducteur: 'missionnaire',
  agent_entretien: 'missionnaire',
}

export function accessFromTitre(titre: Titre): AccessRole {
  return TITRE_TO_ACCESS[titre]
}

// --- Capacités par niveau d'accès (utilisé pour afficher/masquer des actions) ---
export const CAN = {
  signerOM: (r: AccessRole) => r === 'caf' || r === 'de',
  validerTimesheet: (r: AccessRole) => r === 'manager' || r === 'caf' || r === 'admin',
  validerPaiement: (r: AccessRole) => r === 'caf' || r === 'de' || r === 'admin',
  attribuerTitre: (r: AccessRole) => r === 'admin' || r === 'rh' || r === 'caf',
  voirToutesMissions: (r: AccessRole) => ['caf', 'de', 'admin'].includes(r),
}

// Qui peut attribuer un titre (décision : Admin, RH, CAF)
export const ROLES_QUI_ATTRIBUENT: AccessRole[] = ['admin', 'rh', 'caf']
