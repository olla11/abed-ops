import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data } = await supabase
    .from('parametres')
    .select('cle, valeur')
    .in('cle', ['badge_bureau_latitude', 'badge_bureau_longitude', 'badge_rayon_metres'])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.cle, r.valeur]))
  return NextResponse.json({
    latitude: Number(map.badge_bureau_latitude) || null,
    longitude: Number(map.badge_bureau_longitude) || null,
    rayon_metres: Number(map.badge_rayon_metres) || 50,
  })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  const rayon = Math.round(Number(body.rayon_metres))

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: 'Latitude invalide' }, { status: 400 })
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Longitude invalide' }, { status: 400 })
  }
  if (!Number.isFinite(rayon) || rayon < 5 || rayon > 1000) {
    return NextResponse.json({ error: 'Rayon invalide (entre 5 et 1000 mètres)' }, { status: 400 })
  }

  const updates = [
    { cle: 'badge_bureau_latitude', valeur: String(latitude) },
    { cle: 'badge_bureau_longitude', valeur: String(longitude) },
    { cle: 'badge_rayon_metres', valeur: String(rayon) },
  ]
  for (const u of updates) {
    const { error } = await supabase.from('parametres').upsert(u, { onConflict: 'cle' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
