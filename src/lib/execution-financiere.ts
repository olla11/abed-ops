import type { SupabaseClient } from '@supabase/supabase-js'

export type LigneExecutionFinanciere = {
  code: string
  libelle: string
  estRubrique: boolean
  budgetAnnuel: number
  budgetT1: number; budgetT2: number; budgetT3: number; budgetT4: number
  depenseT1: number; depenseT2: number; depenseT3: number; depenseT4: number
  totalDepense: number
  disponible: number
  pctExecution: number
}

export type ExecutionFinanciere = {
  annee: number
  lignes: LigneExecutionFinanciere[]
  totaux: { budgetAnnuel: number; totalDepense: number; disponible: number }
  anneesDisponibles: number[]
}

// Budget adopté vs dépenses réellement exécutées (depenses_executees,
// alimenté automatiquement par le "Marquer payé" AAF de Pay Roll), par code
// budgétaire et par trimestre. Partagé entre l'API JSON (vue à l'écran) et
// le générateur de rapport PDF pour ne calculer les chiffres qu'à un seul
// endroit.
export async function calculerExecutionFinanciere(supabase: SupabaseClient, annee: number): Promise<ExecutionFinanciere> {
  const [{ data: codesTous }, { data: budgets }, { data: depenses }, { data: anneesRows }] = await Promise.all([
    supabase.from('codes_budgetaires').select('code, libelle, ordre').order('ordre'),
    supabase.from('budget_adopte').select('code_budgetaire, montant_annuel, t1_montant, t2_montant, t3_montant, t4_montant').eq('annee', annee),
    supabase.from('depenses_executees').select('code_budgetaire, montant, date_paiement')
      .gte('date_paiement', `${annee}-01-01`).lte('date_paiement', `${annee}-12-31`),
    supabase.from('budget_adopte').select('annee'),
  ])

  // Le sélecteur d'année doit toujours proposer l'année en cours et la
  // suivante (pour préparer/uploader un budget avant même le début de
  // l'année), plus toute année où un budget a déjà été chargé (historique).
  const anneeCourante = new Date().getFullYear()
  const anneesDisponibles = [...new Set([anneeCourante, anneeCourante + 1, ...(anneesRows ?? []).map((r: { annee: number }) => r.annee)])]
    .sort((a, b) => b - a)

  // Les lignes de la vue ne montrent que les codes réellement inscrits au
  // budget adopté de CETTE année — un code créé pour une autre année ou pas
  // encore repris dans le budget de l'année consultée n'a rien à y faire.
  const codesActifs = new Set((budgets ?? []).map((b: { code_budgetaire: string }) => b.code_budgetaire))
  const codes = (codesTous ?? []).filter((c: { code: string }) => codesActifs.has(c.code))

  const budgetParCode = Object.fromEntries((budgets ?? []).map((b: { code_budgetaire: string; montant_annuel: number }) => [b.code_budgetaire, Number(b.montant_annuel)]))
  // Répartition trimestrielle du budget telle qu'adoptée par le CA (souvent
  // inégale d'un trimestre à l'autre) — absente pour une ligne tant que
  // personne ne l'a saisie/importée, auquel cas on retombe sur un quart du
  // budget annuel plutôt que d'afficher un budgété vide à côté d'un dépensé
  // réel.
  const trimParCode: Record<string, [number, number, number, number]> = {}
  for (const b of budgets ?? []) {
    const annuel = Number(b.montant_annuel)
    const t = [b.t1_montant, b.t2_montant, b.t3_montant, b.t4_montant]
    trimParCode[b.code_budgetaire] = t.every(v => v !== null && v !== undefined)
      ? (t.map(Number) as [number, number, number, number])
      : [annuel / 4, annuel / 4, annuel / 4, annuel / 4]
  }

  // Une dépense exécutée sans code budgétaire (import historique, ou
  // paiement pas encore classé par la CAF), ou classée sur un code absent du
  // budget adopté de cette année précise, ne doit pas disparaître
  // silencieusement de la vue — elle apparaît à part, sous "Non classé".
  const NON_CLASSE = '__non_classe__'
  const depenseParCode: Record<string, { total: number; parTrimestre: [number, number, number, number] }> = {}
  for (const d of depenses ?? []) {
    const code = (d.code_budgetaire && codesActifs.has(d.code_budgetaire)) ? d.code_budgetaire : NON_CLASSE
    if (!depenseParCode[code]) depenseParCode[code] = { total: 0, parTrimestre: [0, 0, 0, 0] }
    const trimestre = Math.floor((new Date(d.date_paiement).getMonth()) / 3)
    depenseParCode[code].total += Number(d.montant)
    depenseParCode[code].parTrimestre[trimestre] += Number(d.montant)
  }

  const lignes: LigneExecutionFinanciere[] = (codes ?? []).map((c: { code: string; libelle: string }) => {
    const budget = budgetParCode[c.code] ?? 0
    const dep = depenseParCode[c.code] ?? { total: 0, parTrimestre: [0, 0, 0, 0] }
    const trim = trimParCode[c.code] ?? [0, 0, 0, 0]
    return {
      code: c.code,
      libelle: c.libelle,
      estRubrique: c.code.endsWith('00'),
      budgetAnnuel: budget,
      budgetT1: trim[0], budgetT2: trim[1], budgetT3: trim[2], budgetT4: trim[3],
      depenseT1: dep.parTrimestre[0],
      depenseT2: dep.parTrimestre[1],
      depenseT3: dep.parTrimestre[2],
      depenseT4: dep.parTrimestre[3],
      totalDepense: dep.total,
      disponible: budget - dep.total,
      pctExecution: budget > 0 ? (dep.total / budget) * 100 : 0,
    }
  })

  if (depenseParCode[NON_CLASSE]) {
    const dep = depenseParCode[NON_CLASSE]
    lignes.push({
      code: '—', libelle: 'Non classé (à affecter à un code dans Pay Roll)', estRubrique: false,
      budgetAnnuel: 0, budgetT1: 0, budgetT2: 0, budgetT3: 0, budgetT4: 0,
      depenseT1: dep.parTrimestre[0], depenseT2: dep.parTrimestre[1],
      depenseT3: dep.parTrimestre[2], depenseT4: dep.parTrimestre[3],
      totalDepense: dep.total, disponible: -dep.total, pctExecution: 0,
    })
  }

  // Les rubriques (codes en "00") portent déjà leur propre budget adopté et
  // leurs propres dépenses classées directement dessus (rare) — les totaux
  // globaux ne doivent compter chaque montant qu'une fois, donc seulement
  // les lignes de détail (hors rubriques) pour éviter de doubler les sommes
  // qu'elles chapeautent.
  const lignesDetail = lignes.filter(l => !l.estRubrique)
  const totaux = {
    budgetAnnuel: lignesDetail.reduce((s, l) => s + l.budgetAnnuel, 0),
    totalDepense: lignesDetail.reduce((s, l) => s + l.totalDepense, 0),
    disponible: lignesDetail.reduce((s, l) => s + l.disponible, 0),
  }

  return { annee, lignes, totaux, anneesDisponibles }
}
