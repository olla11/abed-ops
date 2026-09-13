import type { SupabaseClient } from '@supabase/supabase-js'

export type PayRollSourceType = 'demande_paiement' | 'rapport_allocation' | 'reconciliation_mission' | 'timesheet'

// Ajoute (ou retrouve, si déjà présente — voir la contrainte UNIQUE
// (source_type, source_id)) une ligne dans la file Pay Roll dès qu'une des
// 4 sources de paiement atteint son autorisation finale par le DE. Le code
// budgétaire n'est pas toujours connu à ce stade (rapports_allocations,
// missions et timesheets n'en portent pas nativement) — la CAF le complète
// alors elle-même dans Pay Roll avant de générer un appel de fonds.
export async function ajouterAuPayRoll(admin: SupabaseClient, entry: {
  sourceType: PayRollSourceType
  sourceId: string
  reference?: string | null
  beneficiaireId?: string | null
  beneficiaireNom: string
  objet: string
  codeBudgetaire?: string | null
  montant: number
}) {
  const { error } = await admin.from('pay_roll').upsert({
    source_type: entry.sourceType,
    source_id: entry.sourceId,
    reference: entry.reference ?? null,
    beneficiaire_id: entry.beneficiaireId ?? null,
    beneficiaire_nom: entry.beneficiaireNom,
    objet: entry.objet,
    code_budgetaire: entry.codeBudgetaire ?? null,
    montant: entry.montant,
    autorise_de_le: new Date().toISOString(),
  }, { onConflict: 'source_type,source_id', ignoreDuplicates: true })

  if (error) console.error('[pay-roll] échec ajout à la file:', error)
}
