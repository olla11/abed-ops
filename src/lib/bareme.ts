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

// ─── Calcul du taux/prime honoraires ──────────────────────────────────────
// Fonction pure partagée entre le calcul serveur (valider-caf, qui fixe le
// montant réel) et les aperçus côté client (manager, CAF) — pour ne jamais
// avoir deux implémentations qui divergent silencieusement, comme c'était
// le cas quand l'aperçu manager/CAF affichait encore l'ancien taux plat
// pendant que le calcul final utilisait déjà le barème.

export type BaremeHonoraireRow = {
  niveau_fonction: NiveauFonctionHonoraire
  seniorite: Seniorite | null
  montant_heure: number | string
  prime_communication_type: string
  prime_communication_fixe: number | string | null
}

export type PaliersCommunication = {
  palier1_borne_max: number; palier1_montant: number
  palier2_borne_max: number; palier2_montant: number
  palier3_montant: number
}

export function calculerHonoraire(opts: {
  titre: string | null | undefined
  seniorite: string | null | undefined
  typeEmploi: string | null | undefined
  heures: number
  baremes: BaremeHonoraireRow[]
  paliers: PaliersCommunication
  fallbackDirect: number
  fallbackCredit: number
}): { taux: number; prime: number; montant: number; detailPrime: string; source: 'bareme' | 'flat' } {
  const { titre, seniorite, typeEmploi, heures, baremes, paliers, fallbackDirect, fallbackCredit } = opts
  const niveau = getNiveauFonction(titre)
  let taux: number | null = null
  let prime = 0
  let detailPrime = ''
  let source: 'bareme' | 'flat' = 'flat'

  if (niveau) {
    const s = NIVEAUX_AVEC_SENIORITE.includes(niveau) ? (seniorite ?? null) : null
    const row = baremes.find(b => b.niveau_fonction === niveau && (s ? b.seniorite === s : b.seniorite == null))
    if (row) {
      taux = Number(row.montant_heure)
      source = 'bareme'
      if (row.prime_communication_type === 'fixe') {
        prime = Number(row.prime_communication_fixe ?? 0)
        detailPrime = ` + prime communication ${prime.toLocaleString('fr-FR')} F`
      } else if (row.prime_communication_type === 'paliers_heures') {
        prime = heures <= paliers.palier1_borne_max ? paliers.palier1_montant
          : heures <= paliers.palier2_borne_max ? paliers.palier2_montant
          : paliers.palier3_montant
        detailPrime = ` + prime communication ${prime.toLocaleString('fr-FR')} F (${heures}h)`
      }
    }
  }

  if (taux == null) {
    taux = typeEmploi === 'prestataire_credit' ? fallbackCredit : fallbackDirect
  }

  const montant = Math.round(heures * taux) + Math.round(prime)
  return { taux, prime, montant, detailPrime, source }
}
