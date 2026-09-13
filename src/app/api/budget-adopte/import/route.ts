import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// POST multipart { file, annee } — CAF/admin uniquement. Importe le fichier
// généré par /api/budget-adopte/template (colonnes Code / Libellé / Montant),
// une fois complété — pensé pour préparer le budget d'une nouvelle année
// sans ressaisir ligne par ligne dans l'écran.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const annee = Number(form.get('annee'))
  if (!file || file.size === 0) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  if (!annee) return NextResponse.json({ error: 'Année requise' }, { status: 400 })

  let rows: unknown[][]
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
  } catch {
    return NextResponse.json({ error: 'Fichier illisible — utilisez le modèle Excel fourni.' }, { status: 400 })
  }

  const { data: codesExistants } = await supabase.from('codes_budgetaires').select('code')
  const codesValides = new Set((codesExistants ?? []).map(c => c.code))

  type Ligne = { code_budgetaire: string; annee: number; montant_annuel: number; t1_montant: number | null; t2_montant: number | null; t3_montant: number | null; t4_montant: number | null }
  const aImporter: Ligne[] = []
  const ignores: string[] = []

  // Colonnes T1-T4 optionnelles : une cellule vide laisse le trimestre non
  // renseigné (l'exécution financière retombe alors sur un quart du budget
  // annuel) plutôt que d'écraser une répartition déjà saisie par un zéro.
  function parseTrimestre(cell: unknown): number | null {
    if (cell === undefined || cell === null || cell === '') return null
    const n = Number(cell)
    return Number.isFinite(n) ? n : null
  }

  for (const row of rows.slice(1)) {
    const code = String(row[0] ?? '').trim()
    if (!code) continue
    const montant = Number(row[2])
    if (!codesValides.has(code)) { ignores.push(`${code} (code inconnu)`); continue }
    if (!Number.isFinite(montant) || montant < 0) { ignores.push(`${code} (montant invalide)`); continue }
    aImporter.push({
      code_budgetaire: code, annee, montant_annuel: montant,
      t1_montant: parseTrimestre(row[3]), t2_montant: parseTrimestre(row[4]),
      t3_montant: parseTrimestre(row[5]), t4_montant: parseTrimestre(row[6]),
    })
  }

  if (aImporter.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne valide à importer.', ignores }, { status: 400 })
  }

  const { error } = await supabase.from('budget_adopte')
    .upsert(aImporter.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'code_budgetaire,annee' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, importes: aImporter.length, ignores })
}
