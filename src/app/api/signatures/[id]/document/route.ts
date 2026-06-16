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
    .select('id, fichier_url, createur_id')
    .eq('id', demandeId)
    .single()

  if (error || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  // Vérifier que l'utilisateur est créateur ou signataire de cette demande
  const { data: sigRow } = await admin
    .from('signataires')
    .select('profile_id')
    .eq('demande_id', demandeId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (demande.createur_id !== user.id && !sigRow) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  if (!demande.fichier_url) {
    return NextResponse.json({ url: null })
  }

  const rawUrl = demande.fichier_url as string
  const path = rawUrl.includes('/documents/') ? rawUrl.split('/documents/').at(-1) : rawUrl
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
