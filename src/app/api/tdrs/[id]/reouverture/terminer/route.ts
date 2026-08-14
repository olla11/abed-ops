import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { notifyTdr } from '@/lib/tdr-notify'

// Le CAF referme le TdR après correction : tout redevient verrouillé pour
// tout le monde, jusqu'à une éventuelle nouvelle demande de réouverture.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (role !== 'caf' && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Accès réservé au CAF' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs').select('id, numero, titre_activite, statut, reouverte').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })
  if (!tdr.reouverte) return NextResponse.json({ error: "Ce TdR n'est pas en cours de réouverture." }, { status: 409 })

  const { error } = await admin.from('tdrs').update({
    reouverte: false,
    reouverture_terminee_par: user.id,
    reouverture_terminee_le: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await notifyTdr(id, {
    titre: 'TdR reclôturé après correction',
    message: `Le TdR « ${tdr.titre_activite} » (${tdr.numero}) a été corrigé par le CAF et est de nouveau verrouillé.`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
