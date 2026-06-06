// =====================================================================
// ABED-ONG — Titres du personnel et niveaux d'accès
// =====================================================================

export const TYPES_EMPLOI = [
  'benevole',
  'stagiaire_n1',
  'stagiaire_n2',
  'prestataire_direct',
  'prestataire_credit',
  'cdd',
  'cdi',
] as const
export type TypeEmploi = (typeof TYPES_EMPLOI)[number]

export const TITRES = [
  'directeur_executif',
  'directeur_principal',
  'programme_lead',
  'charge_projet',
  'agent_projet',
  'animateur',
  'caf',
  'aaf',
  'assistant_admin',
  'rh',
  'conducteur',
  'agent_entretien',
  'president_ca',
  'secretaire_general_ca',
  'tresorier_ca',
] as const
export type Titre = (typeof TITRES)[number]

export type AccessRole = 'missionnaire' | 'manager' | 'rh' | 'aaf' | 'caf' | 'de' | 'admin' | 'administrateur'

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
  president_ca: 'Président du Conseil d\'Administration',
  secretaire_general_ca: 'Secrétaire Général du Conseil d\'Administration',
  tresorier_ca: 'Trésorier Général du Conseil d\'Administration',
}

// Retourne le titre accordé selon la civilité (M./Dr/Pr = masculin, Mme = féminin)
export function titreLabelGenre(titre: Titre, civilite: string): string {
  const feminine = civilite === 'Mme'
  const overrides: Partial<Record<Titre, [string, string]>> = {
    president_ca: [
      'Président du Conseil d\'Administration',
      'Présidente du Conseil d\'Administration',
    ],
    secretaire_general_ca: [
      'Secrétaire Général du Conseil d\'Administration',
      'Secrétaire Générale du Conseil d\'Administration',
    ],
    tresorier_ca: [
      'Trésorier Général du Conseil d\'Administration',
      'Trésorière Générale du Conseil d\'Administration',
    ],
    directeur_executif: ['Directeur Exécutif', 'Directrice Exécutive'],
    directeur_principal: ['Directeur principal', 'Directrice principale'],
    rh: ['Chargé des Ressources Humaines', 'Chargée des Ressources Humaines'],
    charge_projet: ['Chargé de Projet / opérations', 'Chargée de Projet / opérations'],
  }
  const pair = overrides[titre]
  if (pair) return feminine ? pair[1] : pair[0]
  return TITRE_LABELS[titre]
}

export const TYPE_EMPLOI_LABELS: Record<TypeEmploi, string> = {
  benevole: 'Bénévole',
  stagiaire_n1: 'Stagiaire N1 (- 1 an exp.)',
  stagiaire_n2: 'Stagiaire N2 (1-2 ans exp.)',
  prestataire_direct: 'Prestataire direct (PD)',
  prestataire_credit: 'Prestataire à crédit (PC)',
  cdd: 'Contrat à durée déterminée (CDD)',
  cdi: 'Contrat à durée indéterminée (CDI)',
}

export const TITRE_TO_ACCESS: Record<Titre, AccessRole> = {
  directeur_executif: 'de',
  caf: 'caf',
  rh: 'rh',
  directeur_principal: 'manager',
  programme_lead: 'manager',
  charge_projet: 'manager',
  agent_projet: 'missionnaire',
  animateur: 'missionnaire',
  aaf: 'aaf',
  assistant_admin: 'missionnaire',
  conducteur: 'missionnaire',
  agent_entretien: 'missionnaire',
  president_ca: 'administrateur',
  secretaire_general_ca: 'administrateur',
  tresorier_ca: 'administrateur',
}

export function accessFromTitre(titre: Titre): AccessRole {
  return TITRE_TO_ACCESS[titre]
}

export const CAN = {
  signerOM: (r: AccessRole) => r === 'caf' || r === 'de' || r === 'administrateur' || r === 'admin',
  validerTimesheet: (r: AccessRole) => r === 'manager' || r === 'caf' || r === 'admin' || r === 'administrateur',
  validerPaiement: (r: AccessRole) => r === 'caf' || r === 'de' || r === 'admin' || r === 'administrateur',
  attribuerTitre: (r: AccessRole) => r === 'admin' || r === 'rh' || r === 'caf',
  voirToutesMissions: (r: AccessRole) => ['caf', 'de', 'admin', 'administrateur'].includes(r),
}

export const ROLES_QUI_ATTRIBUENT: AccessRole[] = ['admin', 'rh', 'caf']
