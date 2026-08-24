import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'

const EXT_AUTORISEES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']

// POST /api/bd/opportunites/[id]/upload — même mécanique que
// /api/missions/[id]/reconcile/upload (bucket partagé "timesheets",
// chemin namespacé), pour l'appel/la proposition/la réponse du bailleur.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  if (!profile || !(estBD(profile.titre) || ['admin', 'superadmin'].includes(profile.role))) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!EXT_AUTORISEES.includes(ext)) {
    return NextResponse.json({ error: 'Format non autorisé (PDF, Word, Excel ou image uniquement)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const path = `bd/${id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from('timesheets')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ path, nom: file.name })
}
