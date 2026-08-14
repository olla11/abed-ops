// Système de rédaction et signature des TDR (Termes de Référence).
// Un TDR a toujours exactement ces chapitres (contenu éditable, structure fixe).

import { accordGenre } from './genre'

export type ChapitreType = 'texte' | 'tableau'

export type Chapitre = {
  cle: string
  titre: string
  type: ChapitreType
  texte?: string
  tableau?: { colonnes: string[]; lignes: string[][] }
}

export const CHAPITRES_DEFAUT: Chapitre[] = [
  { cle: 'contexte', titre: 'Contexte et justification', type: 'texte', texte: '' },
  { cle: 'objectifs', titre: 'Objectif général', type: 'texte', texte: '' },
  { cle: 'resultats', titre: 'Résultats attendus et livrables', type: 'texte', texte: '' },
  { cle: 'methodologie', titre: 'Méthodologie/activités', type: 'texte', texte: '' },
  { cle: 'chronogramme', titre: 'Planification des activités (chronogramme)', type: 'tableau', texte: '',
    tableau: { colonnes: ['Activité', 'Acteurs clés', 'Période indicative'], lignes: [] } },
  { cle: 'acteurs', titre: 'Rôles des acteurs et partenaires clés', type: 'tableau', texte: '',
    tableau: { colonnes: ['Acteur', 'Rôle'], lignes: [] } },
  { cle: 'communication', titre: 'Stratégie de communication', type: 'tableau', texte: '',
    tableau: { colonnes: ['Rubrique', 'Détails'], lignes: [] } },
  { cle: 'budget_interne', titre: 'Budget prévisionnel interne', type: 'tableau', texte: '',
    tableau: { colonnes: ['Désignation', 'Unité', 'Qté', 'Coût unitaire (FCFA)', 'Coût total (FCFA)'], lignes: [] } },
  { cle: 'budget', titre: 'Budget prévisionnel détaillé', type: 'tableau', texte: '',
    tableau: { colonnes: ['Désignation', 'Unité', 'Qté', 'Coût unitaire (FCFA)', 'Coût total (FCFA)'], lignes: [] } },
  { cle: 'financement_budget', titre: 'Financement du Budget', type: 'tableau', texte: '',
    tableau: { colonnes: ['Source de financement: Budget', 'Pourcentage (Montant)', 'Titulaire du Budget'], lignes: [] } },
]

export const CHAPITRE_CLES = CHAPITRES_DEFAUT.map(c => c.cle)

// Dans les chapitres budget, les colonnes de coût n'acceptent que des chiffres.
export function isColonneNumerique(chapitreCle: string, nomColonne: string): boolean {
  return (chapitreCle === 'budget' || chapitreCle === 'budget_interne') && /co[uû]t/i.test(nomColonne)
}

// "Financement du Budget" doit toujours avoir exactement les mêmes colonnes
// (source/pourcentage/titulaire), pour que ce tableau soit identique d'un TDR
// à l'autre — l'entête n'est donc ni renommable, ni ajoutable/supprimable.
export function colonnesVerrouillees(chapitreCle: string): boolean {
  return chapitreCle === 'financement_budget'
}

export function chapitresValides(chapitres: unknown): chapitres is Chapitre[] {
  if (!Array.isArray(chapitres) || chapitres.length !== CHAPITRE_CLES.length) return false
  const cles = chapitres.map((c: any) => c?.cle)
  return CHAPITRE_CLES.every(cle => cles.includes(cle))
}

export type TdrStatut =
  | 'brouillon' | 'en_validation_technique' | 'en_validation_caf' | 'en_autorisation_de'
  | 'actif' | 'reconciliation_caf' | 'reconciliation_responsable' | 'cloture'

export const TDR_STATUT_LABELS: Record<TdrStatut, string> = {
  brouillon: 'Brouillon',
  en_validation_technique: 'En validation (Responsable technique)',
  en_validation_caf: 'En validation (CAF)',
  en_autorisation_de: "En autorisation (Directeur Exécutif)",
  actif: 'Actif — suivi financier en cours',
  reconciliation_caf: 'Réconciliation — en attente signature CAF',
  reconciliation_responsable: 'Réconciliation — en attente signature du responsable',
  cloture: 'Clôturé',
}

export type ExecutionStatut = 'complete' | 'partielle'
export const EXECUTION_STATUT_LABELS: Record<ExecutionStatut, string> = {
  complete: 'Exécution complète',
  partielle: 'Exécution partielle',
}

export type SignataireRole = 'initiateur' | 'responsable_technique' | 'caf' | 'de'

export const SIGNATAIRE_ROLE_LABELS: Record<SignataireRole, string> = {
  initiateur: 'Initiateur (élaboré par)',
  responsable_technique: 'Responsable technique (approuvé par)',
  caf: "Visé par la CAF",
  de: 'Autorisé par le Directeur Exécutif',
}

// Le libellé du rôle "de" nomme directement la personne (Directeur/Directrice
// Exécutif/Exécutive) — contrairement aux autres rôles, il doit s'accorder
// avec la civilité de la personne qui occupe ce poste.
export function labelSignataireRole(role: SignataireRole, civilite?: string | null): string {
  if (role === 'de') {
    return accordGenre(civilite, 'Autorisé par le Directeur Exécutif', 'Autorisé par la Directrice Exécutive')
  }
  return SIGNATAIRE_ROLE_LABELS[role]
}

// statut du TDR -> rôle du signataire dont c'est le tour
export const STATUT_TOUR: Partial<Record<TdrStatut, SignataireRole>> = {
  en_validation_technique: 'responsable_technique',
  en_validation_caf: 'caf',
  en_autorisation_de: 'de',
}

// Budget total approuvé = somme de la dernière colonne ("Coût total") du
// chapitre "Budget prévisionnel détaillé" — figé au moment où le TDR
// devient actif (les chapitres ne changent plus après signature).
export function budgetTotalDepuisChapitres(chapitres: Chapitre[]): number {
  const chapitre = chapitres.find(c => c.cle === 'budget')
  if (!chapitre?.tableau) return 0
  let total = 0
  for (const ligne of chapitre.tableau.lignes) {
    const derniere = ligne[ligne.length - 1] ?? ''
    const n = parseInt(derniere.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n)) total += n
  }
  return total
}
