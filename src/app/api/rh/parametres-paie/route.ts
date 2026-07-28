import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type Tranche = { jusqua: number | null; taux: number }

const DEFAUT_BAREME: Tranche[] = [
  { jusqua: 60000, taux: 0 },
  { jusqua: 130000, taux: 10 },
  { jusqua: 280000, taux: 15 },
  { jusqua: 530000, taux: 20 },
  { jusqua: null, taux: 25 },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { data } = await supabase
    .from('parametres').select('cle, valeur')
    .in('cle', ['taux_cnss_employe', 'bareme_its'])

  const tauxCnss = Number(data?.find(d => d.cle === 'taux_cnss_employe')?.valeur ?? 3.6)
  let bareme: Tranche[] = DEFAUT_BAREME
  try {
    const raw = data?.find(d => d.cle === 'bareme_its')?.valeur
    if (raw) bareme = JSON.parse(raw)
  } catch { /* garde le barème par défaut si JSON invalide */ }

  return NextResponse.json({ taux_cnss_employe: tauxCnss, bareme_its: bareme })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { taux_cnss_employe, bareme_its } = await req.json() as {
    taux_cnss_employe: number
    bareme_its: Tranche[]
  }

  if (!Number.isFinite(taux_cnss_employe) || taux_cnss_employe < 0 || taux_cnss_employe > 100) {
    return NextResponse.json({ error: 'Taux CNSS invalide' }, { status: 400 })
  }
  if (!Array.isArray(bareme_its) || bareme_its.some(t => !Number.isFinite(t.taux))) {
    return NextResponse.json({ error: 'Barème ITS invalide' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from('parametres').upsert([
    { cle: 'taux_cnss_employe', valeur: String(taux_cnss_employe) },
    { cle: 'bareme_its', valeur: JSON.stringify(bareme_its) },
  ], { onConflict: 'cle' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
