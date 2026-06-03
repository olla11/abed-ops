import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const slot = (form.get('slot') as string) ?? 'file' // 'timesheet' | 'livrable' | 'facture'
  if (!file) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.storage.createBucket('timesheets', { public: false }).catch(() => {})

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${Date.now()}_${slot}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('timesheets')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ path })
}
