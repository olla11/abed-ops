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

  const path = demande.fichier_url.split('/documents/').at(-1)
  if (!path) {
    return NextResponse.json({ url: null })
  }

  const { data: signed, error: storageErr } = await admin.storage
    .from('documents')
    .createSignedUrl(path, 3600)

  if (storageErr || !signed) {
    console.error('[Document] Storage error:', storageErr)
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
