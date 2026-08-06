import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import { getComposedSignedUrl } from '@/lib/pdf-signature'

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

  // 30 jours — aligné sur la durée de validité du lien de signature lui-même
  // (voir external-signer-token.ts), pour qu'un signataire externe qui
  // revient consulter le document plus d'une heure après l'ouverture de
  // l'email ne se retrouve pas avec un document introuvable. Recompose le
  // PDF depuis l'original intact + les tampons déjà enregistrés (voir
  // getComposedSignedUrl) plutôt que de pointer vers un fichier
  // potentiellement muté en place.
  const url = await getComposedSignedUrl(admin, signataire.demande_id, demande.fichier_url as string, 60 * 60 * 24 * 30)
  if (!url) {
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
