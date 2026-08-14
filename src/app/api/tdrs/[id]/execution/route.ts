import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'

// Champs de suivi financier que l'AAF renseigne lui-même (code budgétaire,
// dates prévues) — n'existaient pas à la création du TDR, l'AAF les
// complète une fois le dossier de suivi ouvert (TDR actif).
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

  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}
  if (body?.code_budgetaire !== undefined) update.code_budgetaire = body.code_budgetaire || null
  if (body?.date_debut_prevue !== undefined) update.date_debut_prevue = body.date_debut_prevue || null
  if (body?.date_fin_prevue !== undefined) update.date_fin_prevue = body.date_fin_prevue || null
  // budget_total_valide est normalement figé automatiquement à la signature
  // finale du DE (somme du chapitre budget), mais reste ajustable par l'AAF :
  // certains TDR (antérieurs à cette automatisation, ou dont le budget a été
  // saisi comme tableau collé au lieu du tableau structuré du chapitre) n'ont
  // rien à sommer automatiquement.
  if (body?.budget_total_valide !== undefined) {
    const n = body.budget_total_valide === null || body.budget_total_valide === '' ? null : Number(body.budget_total_valide)
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      return NextResponse.json({ error: 'Budget approuvé invalide' }, { status: 400 })
    }
    update.budget_total_valide = n
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  update.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { error } = await admin.from('tdrs').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
