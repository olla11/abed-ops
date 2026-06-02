import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['de', 'caf', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null // 'signature' or 'cachet'

  if (!file || !type || !['signature', 'cachet'].includes(type)) {
    return NextResponse.json({ error: 'fichier et type requis (signature|cachet)' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${user.id}/${type}.${ext}`

  // Ensure bucket exists
  await admin.storage.createBucket('assets', { public: false }).catch(() => {})

  const { error: upErr } = await admin.storage
    .from('assets')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const column = type === 'signature' ? 'signature_url' : 'cachet_url'
  await admin.from('profiles').update({ [column]: path }).eq('id', user.id)

  return NextResponse.json({ ok: true, path })
}
