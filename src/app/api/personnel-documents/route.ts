import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const RH_ROLES = ['rh', 'caf', 'admin', 'superadmin']

// GET /api/personnel-documents?profileId=... — liste les documents du dossier
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId requis' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isRH = RH_ROLES.includes(profile?.role ?? '')
  if (profileId !== user.id && !isRH) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('personnel_documents')
    .select('id, categorie, nom_fichier, storage_path, uploaded_by, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// POST /api/personnel-documents — ajoute un document au dossier (multipart)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isRH = RH_ROLES.includes(profile?.role ?? '')

  const form = await req.formData()
  const profileId = form.get('profileId') as string | null
  const categorie = form.get('categorie') as string | null
  const file = form.get('file') as File | null

  if (!profileId || !categorie || !file) {
    return NextResponse.json({ error: 'profileId, categorie et fichier requis' }, { status: 400 })
  }
  if (!['cv', 'diplome', 'piece_identite', 'autre'].includes(categorie)) {
    return NextResponse.json({ error: 'catégorie invalide' }, { status: 400 })
  }
  if (profileId !== user.id && !isRH) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await admin.storage.createBucket('dossiers-personnel', { public: false }).catch(() => {})

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${profileId}/${Date.now()}_${safeName}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('dossiers-personnel')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: inserted, error: insertError } = await supabase
    .from('personnel_documents')
    .insert({ profile_id: profileId, categorie, nom_fichier: file.name, storage_path: storagePath, uploaded_by: user.id })
    .select('id, categorie, nom_fichier, storage_path, uploaded_by, created_at')
    .single()

  if (insertError) {
    await admin.storage.from('dossiers-personnel').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ data: inserted })
}
