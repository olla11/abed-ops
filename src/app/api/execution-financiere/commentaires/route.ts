import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET ?annee=2026 — commentaires CAF sur l'exécution financière de l'année
// (un par trimestre 1-4 + un commentaire annuel en trimestre=0).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()
  const { data, error } = await supabase
    .from('execution_financiere_commentaires').select('trimestre, commentaire, updated_at').eq('annee', annee)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// POST { annee, trimestre: 0 (annuel) | 1-4, commentaire } —
// CAF/admin/superadmin uniquement. Un commentaire vide supprime l'entrée
// plutôt que d'enregistrer une chaîne vide.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { annee, trimestre, commentaire } = await req.json()
  if (!annee) return NextResponse.json({ error: 'Année requise' }, { status: 400 })
  if (![0, 1, 2, 3, 4].includes(trimestre)) {
    return NextResponse.json({ error: 'Trimestre invalide' }, { status: 400 })
  }

  if (!commentaire?.trim()) {
    await supabase.from('execution_financiere_commentaires').delete().eq('annee', annee).eq('trimestre', trimestre)
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase.from('execution_financiere_commentaires')
    .upsert({
      annee, trimestre, commentaire: commentaire.trim(),
      created_by: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'annee,trimestre' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
