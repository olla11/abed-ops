import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; factureId: string }> }) {
  const { id, factureId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs').select('id, statut, reouverte').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })

  // Une fois clôturé, un TdR n'est plus modifiable par personne — sauf
  // réouverture exceptionnelle autorisée par la trésorière générale, et dans
  // ce cas réservée au CAF seul (pas à l'AAF en général).
  const enReouverture = tdr.statut === 'cloture' && tdr.reouverte
  if (enReouverture) {
    if (role !== 'caf' && !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Pendant une réouverture, seul le CAF peut corriger les factures.' }, { status: 403 })
    }
  } else {
    if (!estAAF(role) && !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'accès réservé à l\'AAF' }, { status: 403 })
    }
    if (tdr.statut !== 'actif') {
      return NextResponse.json({ error: "Les factures ne se suppriment que pendant l'exécution active du TdR." }, { status: 409 })
    }
  }

  const { error } = await admin.from('tdr_factures').delete().eq('id', factureId).eq('tdr_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
