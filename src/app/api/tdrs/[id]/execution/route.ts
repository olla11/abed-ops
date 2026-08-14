import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'

// Champs de suivi financier que l'AAF renseigne lui-même (code budgétaire,
// dates prévues, budget approuvé) tant que le TDR est actif. Une fois
// clôturé, plus rien n'est modifiable — sauf le rapport de réconciliation,
// et uniquement par le CAF, pendant une réouverture exceptionnelle
// autorisée par la trésorière générale du conseil d'administration.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!estAAF(role) && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'accès réservé à l\'AAF' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs').select('id, statut, reouverte').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}

  const champsExecution = body?.code_budgetaire !== undefined || body?.date_debut_prevue !== undefined
    || body?.date_fin_prevue !== undefined || body?.budget_total_valide !== undefined
  if (champsExecution) {
    if (tdr.statut !== 'actif') {
      return NextResponse.json({ error: 'Ces paramètres ne se modifient que pendant l\'exécution active du TdR.' }, { status: 409 })
    }
    if (body.code_budgetaire !== undefined) update.code_budgetaire = body.code_budgetaire || null
    if (body.date_debut_prevue !== undefined) update.date_debut_prevue = body.date_debut_prevue || null
    if (body.date_fin_prevue !== undefined) update.date_fin_prevue = body.date_fin_prevue || null
    // budget_total_valide est normalement figé automatiquement à la
    // signature finale du DE (somme du chapitre budget), mais reste
    // ajustable par l'AAF : certains TDR (antérieurs à cette automatisation,
    // ou dont le budget a été saisi comme tableau collé au lieu du tableau
    // structuré du chapitre) n'ont rien à sommer automatiquement.
    if (body.budget_total_valide !== undefined) {
      const n = body.budget_total_valide === null || body.budget_total_valide === '' ? null : Number(body.budget_total_valide)
      if (n !== null && (!Number.isFinite(n) || n < 0)) {
        return NextResponse.json({ error: 'Budget approuvé invalide' }, { status: 400 })
      }
      update.budget_total_valide = n
    }
  }

  if (body?.rapport_reconciliation_texte !== undefined) {
    const enReouverture = tdr.statut === 'cloture' && tdr.reouverte
    if (!enReouverture) {
      return NextResponse.json({ error: 'Le rapport de réconciliation ne se modifie que pendant une réouverture autorisée.' }, { status: 409 })
    }
    if (role !== 'caf' && !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Pendant une réouverture, seul le CAF peut corriger le rapport.' }, { status: 403 })
    }
    const texte = String(body.rapport_reconciliation_texte).trim()
    if (!texte) return NextResponse.json({ error: 'Le rapport de réconciliation est obligatoire.' }, { status: 400 })
    update.rapport_reconciliation_texte = texte
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  update.updated_at = new Date().toISOString()

  const { error } = await admin.from('tdrs').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
