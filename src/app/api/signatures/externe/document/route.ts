import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const payload = verifyExternalSignerToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 401 })

  const admin = createAdminClient()

  const { data: signataire } = await admin
    .from('signataires')
    .select('id, demande_id, email')
    .eq('id', payload.signataireId)
    .single()

  if (!signataire || signataire.email !== payload.email) {
    return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  }

  const { data: demande } = await admin
    .from('demandes_signature')
    .select('fichier_url')
    .eq('id', signataire.demande_id)
    .single()

  if (!demande?.fichier_url) {
    return NextResponse.json({ url: null })
  }

  const rawUrl = demande.fichier_url as string
  const path = rawUrl.includes('/documents/') ? rawUrl.split('/documents/').at(-1) : rawUrl
  if (!path) return NextResponse.json({ url: null })

  const { data: signed, error: storageErr } = await admin.storage
    .from('documents')
    .createSignedUrl(path, 3600)

  if (storageErr || !signed) {
    console.error('[Document externe] Storage error:', storageErr)
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
