import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

const EXT_AUTORISEES = ['pdf', 'doc', 'docx', 'xls', 'xlsx']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: mission } = await supabase
    .from('missions').select('id, missionnaire_id').eq('id', id).single()
  if (!mission || mission.missionnaire_id !== user.id) {
    return NextResponse.json({ error: 'mission introuvable' }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!EXT_AUTORISEES.includes(ext)) {
    return NextResponse.json({ error: 'Format non autorisé (PDF, Word ou Excel uniquement)' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin.storage.createBucket('timesheets', { public: false }).catch(() => {})
  const path = `${user.id}/${id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('timesheets')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ path, nom: file.name })
}
