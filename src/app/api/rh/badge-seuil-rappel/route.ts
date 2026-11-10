import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estRH } from '@/lib/roles'

const CLE = 'badge_seuil_jours_rappel'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data } = await supabase.from('parametres').select('valeur').eq('cle', CLE).maybeSingle()
  return NextResponse.json({ seuil: Number(data?.valeur) || 3 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { seuil } = await req.json()
  const n = Number(seuil)
  if (!Number.isInteger(n) || n < 1 || n > 30) {
    return NextResponse.json({ error: 'Seuil invalide (1 à 30 jours)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('parametres')
    .upsert({ cle: CLE, valeur: String(n) }, { onConflict: 'cle' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
