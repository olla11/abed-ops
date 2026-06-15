import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: demandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demande, error } = await admin
    .from('demandes_signature')
    .select('id, fichier_url')
    .eq('id', demandeId)
    .single()

  if (error || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  if (!demande.fichier_url) {
    return NextResponse.json({ url: null })
  }

  // fichier_url: https://xxx.supabase.co/storage/v1/object/public/documents/USER_ID/1234_file.pdf
  // Extract part after '/documents/'
  const path = demande.fichier_url.split('/documents/').at(-1)

  if (!path) {
    return NextResponse.json({ error: 'Chemin de fichier invalide' }, { status: 400 })
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('documents')
    .createSignedUrl(path, 3600)

  if (signErr || !signed) {
    console.error('[Document] Signed URL error:', signErr)
    return NextResponse.json({ error: 'Impossible de générer le lien' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
