import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import { embedSignatureInPdf, storagePathFromFichierUrl } from '@/lib/pdf-signature'
import { finalizeAfterSignature, verifierTour } from '@/lib/signature-completion'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const sig_x: number | undefined = typeof body?.sig_x === 'number' ? body.sig_x : undefined
  const sig_y: number | undefined = typeof body?.sig_y === 'number' ? body.sig_y : undefined
  const sig_page: number | undefined = typeof body?.sig_page === 'number' ? body.sig_page : undefined
  const sig_image: string | undefined = typeof body?.sig_image === 'string' && body.sig_image.startsWith('data:image/png') ? body.sig_image : undefined

  const payload = verifyExternalSignerToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 401 })

  const admin = createAdminClient()

  const { data: signataire, error: sigErr } = await admin
    .from('signataires')
    .select('id, demande_id, email, nom_externe, signe, est_observateur, ordre')
    .eq('id', payload.signataireId)
    .single()

  if (sigErr || !signataire || signataire.email !== payload.email) {
    return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  }
  // Un observateur (destinataire non-signataire) ne peut jamais signer, même
  // avec un token valide — il n'a été ajouté que pour recevoir le document
  // final (voir finalizeAfterSignature).
  if (signataire.est_observateur) return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  if (signataire.signe) return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })
  if (!signataire.nom_externe) return NextResponse.json({ error: 'Veuillez d\'abord indiquer votre nom et prénom' }, { status: 400 })

  const { data: demande, error: demandeErr } = await admin
    .from('demandes_signature')
    .select('id, titre, description, statut, createur_id, fichier_url')
    .eq('id', signataire.demande_id)
    .single()

  if (demandeErr || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.statut === 'complete') return NextResponse.json({ error: 'Cette demande est déjà complète' }, { status: 400 })
  if (demande.statut === 'refusee') return NextResponse.json({ error: 'Cette demande est en attente de correction et ne peut pas être signée' }, { status: 400 })

  // Signature dans l'ordre choisi : bloque toute tentative avant le tour du
  // signataire.
  const tour = await verifierTour(admin, signataire.demande_id, signataire.ordre)
  if (!tour.ok) {
    return NextResponse.json({ error: `Ce n'est pas encore votre tour de signer. En attente de : ${tour.enAttenteDe}.` }, { status: 403 })
  }

  const signerName = signataire.nom_externe

  // Valide que la signature peut réellement être incrustée (image lisible,
  // page valide) AVANT de l'enregistrer — mais n'écrit plus jamais dans le
  // fichier PDF partagé lui-même. Le tampon (image PNG) est désormais
  // conservé en base, par signataire ; le PDF entièrement signé est
  // recomposé à la demande depuis l'original intact + tous les tampons
  // enregistrés (voir composeSignedPdf). Cela élimine par construction le
  // bug où le fichier partagé, muté en place à chaque signature, perdait
  // parfois une signature précédente écrasée par la suivante.
  if (demande.fichier_url) {
    if (sig_x === undefined || sig_y === undefined || !sig_image) {
      return NextResponse.json({ error: 'Signature invalide : position ou image de la signature manquante. Rechargez la page et réessayez.' }, { status: 400 })
    }
    const filePath = storagePathFromFichierUrl(demande.fichier_url as string)
    if (!filePath) {
      return NextResponse.json({ error: 'Chemin du document introuvable.' }, { status: 500 })
    }

    const { data: fileData, error: downloadErr } = await admin.storage.from('documents').download(filePath)
    if (downloadErr || !fileData) {
      console.error('[Sign externe] PDF download error:', downloadErr)
      return NextResponse.json({ error: 'Impossible de récupérer le document pour y apposer votre signature. Réessayez.' }, { status: 500 })
    }

    try {
      const pdfBytes = await fileData.arrayBuffer()
      await embedSignatureInPdf(pdfBytes, sig_image, sig_x, sig_y, (sig_page ?? 1) - 1)
    } catch (pdfErr) {
      console.error('[Sign externe] PDF embed validation error:', pdfErr)
      return NextResponse.json({ error: 'Erreur lors de l\'apposition de votre signature sur le document. Réessayez.' }, { status: 500 })
    }
  }

  // Conditionné à signe=false pour détecter une double soumission (double-
  // clic, requête relancée) : la signature a déjà été validée ci-dessus,
  // inutile de la retraiter côté finalisation.
  const updatePayload: Record<string, unknown> = { signe: true, signe_le: new Date().toISOString() }
  if (sig_x !== undefined) updatePayload.sig_x = sig_x
  if (sig_y !== undefined) updatePayload.sig_y = sig_y
  if (sig_page !== undefined) updatePayload.sig_page = sig_page
  if (sig_image) updatePayload.sig_image_b64 = sig_image

  const { data: updatedRows, error: updateErr } = await admin
    .from('signataires').update(updatePayload).eq('id', signataire.id).eq('signe', false).select('id')
  if (updateErr) {
    console.error('[Signatures externe] Update signataire error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: true, allSigned: false })
  }

  const { allSigned } = await finalizeAfterSignature(admin, demande.id, demande, signerName, null)

  return NextResponse.json({ ok: true, allSigned })
}
