import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// POST /api/admin/announcements/upload — dépose une pièce jointe pour une
// communication ciblée (envoi immédiat ou programmé). Retourne le chemin de
// stockage à repasser à /api/admin/send-email dans piecesJointes.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'caf', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'fichier trop volumineux (8 Mo max)' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await admin.storage.createBucket('announcement-attachments', { public: false }).catch(() => {})

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${user.id}/${Date.now()}_${safeName}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('announcement-attachments')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    data: { path, filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size },
  })
}
