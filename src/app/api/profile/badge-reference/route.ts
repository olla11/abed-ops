import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Enregistre la photo de référence pour le badgeage (distincte de la photo
// de profil) + son gabarit facial (calculé côté navigateur, voir
// src/lib/face-client.ts) — nécessaire avant de pouvoir badger depuis un
// nouvel appareil.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const descriptorRaw = formData.get('descriptor') as string | null
  if (!file) return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
  if (!descriptorRaw) return NextResponse.json({ error: 'Aucun visage détecté sur la photo — reprenez-la de face, bien éclairée.' }, { status: 400 })

  let descriptor: number[]
  try {
    descriptor = JSON.parse(descriptorRaw)
    if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every(n => typeof n === 'number')) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Gabarit facial invalide' }, { status: 400 })
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (jpg, png, webp)' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/badge-reference.${ext}`
  const bytes = await file.arrayBuffer()

  await admin.storage.createBucket('avatars', { public: true }).catch(() => {})

  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)

  const { error: updErr } = await admin.from('profiles')
    .update({ photo_reference_badge_url: publicUrl, face_descriptor: descriptor })
    .eq('id', user.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, url: publicUrl })
}
