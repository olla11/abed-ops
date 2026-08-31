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
  'cdi',
] as const
export type TypeEmploi = (typeof TYPES_EMPLOI)[number]

// --- Titres / fonctions (Politique de rémunération, Tableau 2) ---
export const TITRES = [
  'directeur_executif',
  'directeur_programmes',
  'directeur_principal',
  'representant_pays',
  'programme_lead',
  'charge_projet',
  'agent_projet',
  'animateur',
  'responsable_communication',
  'assistant_communication',
  'business_developer',
  'caf',
  'aaf',
  'assistant_admin',
  'rh',
  'conducteur',
  'agent_entretien',
  'president_ca',
  'secretaire_general_ca',
  'tresorier_ca',
  'stagiaire_academique',
] as const
export type Titre = (typeof TITRES)[number]

export type AccessRole = 'missionnaire' | 'manager' | 'rh' | 'aaf' | 'caf' | 'de' | 'dp' | 'admin' | 'administrateur'

// --- Libellés lisibles ---
export const TITRE_LABELS: Record<Titre, string> = {
  directeur_executif: 'Directeur Exécutif',
  directeur_programmes: 'Directeur des Programmes',
  directeur_principal: 'Directeur principal',
  representant_pays: 'Représentant Pays',
  programme_lead: 'Programme Lead / Manager',
  charge_projet: 'Chargé de Projet / opérations',
  agent_projet: 'Agent de projet / superviseur',
  animateur: 'Animateur / Coach / Facilitateur',
  responsable_communication: 'Responsable communication',
  assistant_communication: 'Assistant communication',
  business_developer: 'Business Developer',
  caf: 'Chargé Administration & Finances (CAF)',
  aaf: 'Assistant administratif et financier (AAF)',
  assistant_admin: 'Assistant administration',
  rh: 'Chargé des Ressources Humaines',
  conducteur: 'Conducteur véhicule',
  agent_entretien: "Agent d'entretien / sécurité / coursier",
  president_ca: "Président du Conseil d'Administration",
  secretaire_general_ca: "Secrétaire Général du Conseil d'Administration",
  tresorier_ca: "Trésorier Général du Conseil d'Administration",
  stagiaire_academique: 'Stagiaire académique',
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

// --- Mapping TITRE -> niveau d'accès ---
// C'est ici que "le titre détermine les droits".
export const TITRE_TO_ACCESS: Record<Titre, AccessRole> = {
  directeur_executif: 'de',
  directeur_programmes: 'dp',
  caf: 'caf',
  rh: 'rh',
  directeur_principal: 'manager',
  representant_pays: 'manager',
  programme_lead: 'manager',
  charge_projet: 'manager',     // peut superviser des agents/prestataires
  agent_projet: 'missionnaire',
  animateur: 'missionnaire',
  responsable_communication: 'manager',
  assistant_communication: 'missionnaire',
  business_developer: 'manager',
  aaf: 'aaf',
  assistant_admin: 'missionnaire',
  conducteur: 'missionnaire',
  agent_entretien: 'missionnaire',
  president_ca: 'administrateur',
  secretaire_general_ca: 'administrateur',
  tresorier_ca: 'administrateur',
  stagiaire_academique: 'missionnaire',
}

export function accessFromTitre(titre: Titre): AccessRole {
  return TITRE_TO_ACCESS[titre]
}

// --- Capacités par niveau d'accès (utilisé pour afficher/masquer des actions) ---
// signerOM : indicateur approximatif (par rôle seul) des personnes qui
// peuvent un jour signer un OM. La règle réelle est plus fine et dépend
// aussi de qui est le missionnaire — voir src/app/api/missions/[id]/signer/route.ts :
//   - Cas général : seul le DE signe.
//   - OM du DE lui-même (il ne peut pas s'auto-signer) : seuls le CAF
//     (mention "Pour Ordre") ou le Président du CA peuvent signer — le
//     Président se distingue par son `titre` ('president_ca'), pas par
//     l'AccessRole 'administrateur' seul (partagé avec les autres membres
//     du CA, qui eux ne signent jamais).
export const CAN = {
  signerOM: (r: AccessRole) => r === 'caf' || r === 'de',
  validerTimesheet: (r: AccessRole) => r === 'manager' || r === 'caf' || r === 'admin',
  validerPaiement: (r: AccessRole) => r === 'caf' || r === 'de' || r === 'dp' || r === 'admin',
  attribuerTitre: (r: AccessRole) => r === 'admin' || r === 'rh',
  voirToutesMissions: (r: AccessRole) => ['caf', 'de', 'dp', 'admin'].includes(r),
}

// Qui peut attribuer un titre (décision : Admin, RH — retiré de la CAF)
export const ROLES_QUI_ATTRIBUENT: AccessRole[] = ['admin', 'rh']

// --- Hiérarchie CAF ↔ AAF / RH ---
// Le/la CAF est le/la responsable hiérarchique de l'AAF et des RH : il/elle
// voit et peut agir sur tout ce que ces deux rôles voient/peuvent faire, en
// plus de ses propres droits. Toute vérification de rôle 'aaf' ou 'rh' dans
// l'app (API, RLS, navigation) doit passer par ces fonctions plutôt que par
// une comparaison stricte (`role === 'aaf'`), pour que ce chevauchement
// reste vrai partout sans dupliquer 'caf' dans chaque liste de rôles.
export const estAAF = (r?: string | null) => r === 'aaf' || r === 'caf'
export const estRH = (r?: string | null) => r === 'rh' || r === 'caf'

// Contrairement à estAAF/estRH (chevauchement dans les deux sens), le menu
// CAF Pro est exclusif au rôle 'caf' lui-même — personne d'autre n'hérite
// des étapes de validation propres à la CAF.
export const estCAF = (r?: string | null) => r === 'caf'

// Le DE n'hérite d'aucun autre menu (contrairement à la CAF qui hérite
// AAF/RH) — rôle autonome, comme AAF seul.
export const estDE = (r?: string | null) => r === 'de'

// Business Developer : contrairement à AAF/CAF/DE, ce n'est PAS un
// AccessRole dédié — le titre partage l'accès 'manager' avec plusieurs
// autres postes (Représentant Pays, Programme Lead, Chargé de Projet,
// Responsable communication), volontairement, pour hériter des mêmes
// capacités manager sans dupliquer ces vérifications partout. Le menu BD se
// distingue donc par le TITRE, pas par le rôle d'accès.
export const estBD = (titre?: string | null) => titre === 'business_developer'
