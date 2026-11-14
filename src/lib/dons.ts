import type { SupabaseClient } from '@supabase/supabase-js'

export const NOM_CLUB = 'ABED Héritage'
export const MOMO_PAY_ABED = '65460'

export function codeUssdDon(montant: number): string {
  return `*880*41*${MOMO_PAY_ABED}*${Math.round(montant)}#`
}

export function montantDon(base: number, pourcentage: number): number {
  return Math.round((base * pourcentage) / 100)
}

export type Distinction = 'or' | 'argent' | 'bronze'
export type RangDonateur = { profileId: string; rang: number; distinction: Distinction | null }

export const DISTINCTION_LABELS: Record<Distinction, string> = { or: 'Or', argent: 'Argent', bronze: 'Bronze' }

// Classement d'une année : total des dons confirmés par personne, du plus
// grand au plus petit (égalité : le premier à avoir donné passe devant).
// Les 3 premiers reçoivent Or, Argent, Bronze. Les montants ne quittent
// jamais le serveur — seul le rang est exposé.
export async function classementAnnuel(admin: SupabaseClient, annee: number): Promise<RangDonateur[]> {
  const { data } = await admin.from('dons').select('profile_id, montant, created_at')
    .eq('statut', 'confirme').gte('created_at', `${annee}-01-01`).lt('created_at', `${annee + 1}-01-01`)

  const parProfil = new Map<string, { total: number; premier: string }>()
  for (const d of data ?? []) {
    const cur = parProfil.get(d.profile_id) ?? { total: 0, premier: d.created_at }
    cur.total += Number(d.montant)
    if (d.created_at < cur.premier) cur.premier = d.created_at
    parProfil.set(d.profile_id, cur)
  }

  const DISTINCTIONS: Distinction[] = ['or', 'argent', 'bronze']
  return [...parProfil.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[1].premier.localeCompare(b[1].premier))
    .map(([profileId], i) => ({ profileId, rang: i + 1, distinction: DISTINCTIONS[i] ?? null }))
}

// Clôture d'une mission à crédit/sur avance : si le missionnaire a renoncé à
// tout ou partie de son remboursement (don "abandon_credit"), le montant
// versé au Pay Roll est réduit d'autant et le don devient définitif. Le
// pourcentage est réappliqué au montant dû réel à la clôture plutôt qu'au
// montant estimé lors de la soumission.
export async function appliquerAbandonCredit(admin: SupabaseClient, missionId: string, montantDu: number, validePar: string | null): Promise<number> {
  const { data: don } = await admin.from('dons')
    .select('id, pourcentage').eq('mission_id', missionId).eq('type', 'abandon_credit').eq('statut', 'declare').maybeSingle()
  if (!don || montantDu <= 0) return montantDu

  const montant = Math.min(montantDu, montantDon(montantDu, Number(don.pourcentage)))
  await admin.from('dons').update({
    base_montant: montantDu, montant, statut: 'confirme',
    traite_par: validePar, traite_le: new Date().toISOString(),
  }).eq('id', don.id)
  return montantDu - montant
}
