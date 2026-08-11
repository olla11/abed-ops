import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  return { supabase, userId: user.id }
}

async function requireCaf() {
  const check = await requireAuth()
  if ('error' in check) return check
  const { data: profile } = await check.supabase.from('profiles').select('role').eq('id', check.userId).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return { error: NextResponse.json({ error: 'accès réservé au CAF' }, { status: 403 }) }
  }
  return check
}

// GET : lecture ouverte à tout compte connecté (utilisée aussi par RH pour
// la création de contrat) — seule l'écriture (PUT) est réservée au CAF.
export async function GET() {
  const check = await requireAuth()
  if ('error' in check) return check.error
  const { data, error } = await check.supabase
    .from('bareme_honoraires')
    .select('*')
    .order('niveau_fonction')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const check = await requireCaf()
  if ('error' in check) return check.error
  const { supabase, userId } = check

  const body = await req.json().catch(() => null)
  const rows = body?.rows
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows requis' }, { status: 400 })

  for (const r of rows) {
    if (!r.id || !r.montant_heure || +r.montant_heure <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }
    const update: Record<string, unknown> = {
      montant_heure: +r.montant_heure,
      prime_communication_type: r.prime_communication_type,
      prime_communication_fixe: r.prime_communication_fixe != null ? +r.prime_communication_fixe : null,
      updated_at: new Date().toISOString(),
      updated_par: userId,
    }
    const { error } = await supabase.from('bareme_honoraires').update(update).eq('id', r.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
