import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { NOM_CLUB } from '@/lib/dons'

const EXT_CAPTURE = ['jpg', 'jpeg', 'png', 'webp', 'pdf']

// Don spontané hors mission, depuis Mon espace (/dons) : versement MoMo Pay
// déjà effectué, capture jointe, à confirmer par AAF/CAF/DE (voir
// /api/dons/[id]/traiter) avant d'être compté au tableau d'honneur.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const limited = rateLimit(req, { limit: 10, window: 60 }, user.id)
  if (limited) return limited

  const form = await req.formData()
  const montant = Math.round(Number(form.get('montant')))
  const file = form.get('capture') as File | null

  if (!Number.isFinite(montant) || montant < 100) {
    return NextResponse.json({ error: 'Montant invalide (100 F CFA minimum).' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Joignez la capture du paiement MoMo.' }, { status: 400 })
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!EXT_CAPTURE.includes(ext)) {
    return NextResponse.json({ error: 'Capture : image ou PDF uniquement.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const path = `${user.id}/dons/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: upErr } = await admin.storage.from('timesheets')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const { error } = await admin.from('dons').insert({
    profile_id: user.id, type: 'libre', montant, capture_path: path, statut: 'declare',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: moi } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const { data: valideurs } = await admin.from('profiles').select('id')
    .in('role', ['aaf', 'caf']).eq('archived', false)
  if (valideurs?.length) {
    await admin.from('notifications').insert(valideurs.map(v => ({
      user_id: v.id,
      titre: `Don ${NOM_CLUB} à confirmer`,
      message: `${moi?.prenoms ?? ''} ${moi?.nom ?? ''} a déclaré un don de ${montant.toLocaleString('fr-FR')} F CFA. Vérifiez la capture et confirmez.`,
      lien: '/dons',
    })))
  }

  return NextResponse.json({ ok: true })
}
