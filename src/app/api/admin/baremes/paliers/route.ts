import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const CLES = [
  'prime_comm_palier1_borne_max', 'prime_comm_palier1_montant',
  'prime_comm_palier2_borne_max', 'prime_comm_palier2_montant',
  'prime_comm_palier3_montant',
]

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  return { supabase }
}

async function requireCaf() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return { error: NextResponse.json({ error: 'accès réservé au CAF' }, { status: 403 }) }
  }
  return { supabase }
}

// GET : lecture ouverte à tout compte connecté — seule l'écriture (PUT)
// est réservée au CAF.
export async function GET() {
  const check = await requireAuth()
  if ('error' in check) return check.error
  const { data, error } = await check.supabase
    .from('parametres').select('cle, valeur').in('cle', CLES)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const map = Object.fromEntries((data ?? []).map(r => [r.cle, Number(r.valeur)]))
  return NextResponse.json({
    palier1_borne_max: map['prime_comm_palier1_borne_max'] ?? 100,
    palier1_montant: map['prime_comm_palier1_montant'] ?? 15000,
    palier2_borne_max: map['prime_comm_palier2_borne_max'] ?? 200,
    palier2_montant: map['prime_comm_palier2_montant'] ?? 25000,
    palier3_montant: map['prime_comm_palier3_montant'] ?? 35000,
  })
}

export async function PUT(req: NextRequest) {
  const check = await requireCaf()
  if ('error' in check) return check.error
  const { supabase } = check

  const body = await req.json().catch(() => null)
  const map: Record<string, unknown> = {
    prime_comm_palier1_borne_max: body?.palier1_borne_max,
    prime_comm_palier1_montant: body?.palier1_montant,
    prime_comm_palier2_borne_max: body?.palier2_borne_max,
    prime_comm_palier2_montant: body?.palier2_montant,
    prime_comm_palier3_montant: body?.palier3_montant,
  }
  for (const cle of CLES) {
    const v = map[cle]
    if (v == null || +v <= 0) return NextResponse.json({ error: `Valeur invalide pour ${cle}` }, { status: 400 })
    const { error } = await supabase.from('parametres').upsert({ cle, valeur: String(Math.round(+v)) }, { onConflict: 'cle' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
