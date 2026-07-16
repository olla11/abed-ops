import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { chapitresValides } from '@/lib/tdr'
import { sanitizeChapitres } from '@/lib/tdr-sanitize'
import { notifyTdr } from '@/lib/tdr-notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'caf') return NextResponse.json({ error: 'Accès réservé au CAF' }, { status: 403 })

  const { data: tdr } = await supabase.from('tdrs').select('*').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.statut !== 'actif') {
    return NextResponse.json({ error: 'Seul un TDR actif peut être clôturé' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const admin = createAdminClient()

  const update: Record<string, unknown> = {
    statut: 'cloture',
    cloture_par: user.id,
    cloture_le: new Date().toISOString(),
    cloture_notes: (body?.cloture_notes ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (body?.chapitres !== undefined) {
    if (!chapitresValides(body.chapitres)) {
      return NextResponse.json({ error: 'Les 8 chapitres du TDR sont obligatoires' }, { status: 400 })
    }
    update.chapitres = sanitizeChapitres(body.chapitres)
  }

  const { error } = await admin.from('tdrs').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyTdr(id, {
    titre: 'TDR clôturé',
    message: `Le TDR « ${tdr.titre_activite} » (${tdr.numero}) a été clôturé.`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
