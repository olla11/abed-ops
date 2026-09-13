import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { creerAppelDeFonds } from '@/lib/appel-de-fonds'

// POST { payRollIds: string[], commentaireCaf?: string } — CAF/admin
// uniquement. Regroupe les paiements sélectionnés par code budgétaire,
// génère le PDF et lance le circuit de signature DE → TG CA → PCA.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { payRollIds, commentaireCaf } = await req.json()
  if (!Array.isArray(payRollIds) || payRollIds.length === 0) {
    return NextResponse.json({ error: 'Sélectionnez au moins un paiement.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const result = await creerAppelDeFonds(admin, {
    payRollIds, commentaireCaf: commentaireCaf?.trim() || null, createurId: user.id,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, numero: result.numero, appelDeFondsId: result.appelDeFondsId })
}
