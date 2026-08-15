import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { convertirEnHtmlEditable, formatConvertible } from '@/lib/document-convert'

// Liste des documents en révision collaborative (distincts des demandes de
// signature directe, qui restent gérées par /signatures). Lecture ouverte à
// tout utilisateur authentifié — même posture que demandes_signature/
// signataires existants (RLS).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('demandes_signature')
    .select('id, titre, description, statut, created_at, updated_at, createur:profiles!demandes_signature_createur_id_fkey(id, nom, prenoms)')
    .eq('type', 'document_collaboratif')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const titre = (formData.get('titre') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const fichier = formData.get('fichier') as File | null

  if (!titre) return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
  if (!fichier || fichier.size === 0) return NextResponse.json({ error: 'Le document est requis' }, { status: 400 })
  if (!formatConvertible(fichier.name)) {
    return NextResponse.json({ error: `Format "${fichier.name}" non pris en charge pour la révision collaborative. Utilisez un Word (.docx) ou un PDF.` }, { status: 400 })
  }

  const buffer = Buffer.from(await fichier.arrayBuffer())
  let contenuHtml: string | null
  try {
    contenuHtml = await convertirEnHtmlEditable(buffer, fichier.name)
  } catch (e) {
    console.error('[documents] échec conversion:', e)
    return NextResponse.json({ error: `Impossible de lire "${fichier.name}" — le fichier est peut-être corrompu.` }, { status: 400 })
  }
  if (!contenuHtml) return NextResponse.json({ error: 'Conversion impossible pour ce format.' }, { status: 400 })

  const admin = createAdminClient()
  await admin.storage.createBucket('documents', { public: false }).catch(() => {})

  const uploadName = fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${user.id}/${Date.now()}_${uploadName}`
  const { error: uploadErr } = await admin.storage.from('documents').upload(path, buffer, {
    contentType: fichier.type || 'application/octet-stream', upsert: false,
  })
  if (uploadErr) return NextResponse.json({ error: `Erreur upload : ${uploadErr.message}` }, { status: 500 })

  const { data: demande, error: insertErr } = await admin.from('demandes_signature').insert({
    titre, description, createur_id: user.id,
    type: 'document_collaboratif', statut: 'revision',
    contenu_html: contenuHtml, fichier_original_url: path,
  }).select('id').single()
  if (insertErr || !demande) return NextResponse.json({ error: insertErr?.message ?? 'Erreur lors de la création' }, { status: 500 })

  // Le créateur a toujours accès en édition à son propre document.
  await admin.from('document_participants').insert({
    demande_id: demande.id, profile_id: user.id, permission: 'edition', invited_by: user.id,
  })

  return NextResponse.json({ data: { id: demande.id } })
}
