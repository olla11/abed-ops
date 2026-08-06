import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { embedSignatureInPdf, shortHash, storagePathFromFichierUrl } from '@/lib/pdf-signature'
import { finalizeAfterSignature, verifierTour } from '@/lib/signature-completion'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: demandeId } = await params

  let sig_x: number | undefined
  let sig_y: number | undefined
  let sig_page: number | undefined
  let sig_image: string | undefined
  try {
    const body = await req.json()
    if (typeof body.sig_x === 'number') sig_x = body.sig_x
    if (typeof body.sig_y === 'number') sig_y = body.sig_y
    if (typeof body.sig_page === 'number') sig_page = body.sig_page
    if (typeof body.sig_image === 'string' && body.sig_image.startsWith('data:image/png')) sig_image = body.sig_image
  } catch { /* empty body */ }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demande, error: demandeErr } = await admin
    .from('demandes_signature')
    .select('id, titre, description, statut, createur_id, fichier_url')
    .eq('id', demandeId)
    .single()

  if (demandeErr || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.statut === 'complete') return NextResponse.json({ error: 'Cette demande est déjà complète' }, { status: 400 })
  if (demande.statut === 'refusee') return NextResponse.json({ error: 'Cette demande est en attente de correction et ne peut pas être signée' }, { status: 400 })

  const { data: signataire, error: sigErr } = await admin
    .from('signataires')
    .select('id, signe, est_observateur, ordre')
    .eq('demande_id', demandeId)
    .eq('profile_id', user.id)
    .single()

  if (sigErr || !signataire) return NextResponse.json({ error: "Vous n'êtes pas signataire de ce document" }, { status: 403 })
  // Un observateur (destinataire non-signataire) ne peut jamais signer, même
  // en appelant cette route directement — il n'a été ajouté que pour
  // recevoir le document final (voir finalizeAfterSignature).
  if (signataire.est_observateur) return NextResponse.json({ error: "Vous n'êtes pas signataire de ce document" }, { status: 403 })
  if (signataire.signe) return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })

  // Signature dans l'ordre choisi : bloque toute tentative avant le tour du
  // signataire (lien connu à l'avance, plusieurs onglets, etc.) — pas
  // seulement un décalage de notification.
  const tour = await verifierTour(admin, demandeId, signataire.ordre)
  if (!tour.ok) {
    return NextResponse.json({ error: `Ce n'est pas encore votre tour de signer. En attente de : ${tour.enAttenteDe}.` }, { status: 403 })
  }

  // Get signer name
  const { data: signerProfile } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const signerName = signerProfile ? `${signerProfile.prenoms} ${signerProfile.nom}` : 'Signataire'
  const sigDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(user.id + demandeId + sigDate)

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
      console.error('[Sign] PDF download error:', downloadErr)
      return NextResponse.json({ error: 'Impossible de récupérer le document pour y apposer votre signature. Réessayez.' }, { status: 500 })
    }

    try {
      const pdfBytes = await fileData.arrayBuffer()
      await embedSignatureInPdf(pdfBytes, sig_image, sig_x, sig_y, (sig_page ?? 1) - 1)
    } catch (pdfErr) {
      console.error('[Sign] PDF embed validation error:', pdfErr)
      return NextResponse.json({ error: 'Erreur lors de l\'apposition de votre signature sur le document. Réessayez.' }, { status: 500 })
    }
  }

  // Update signataire — conditionné à signe=false pour détecter une double
  // soumission (double-clic, requête relancée) : la signature a déjà été
  // validée ci-dessus, inutile de la retraiter côté finalisation
  // (notifications, envoi aux destinataires, etc.).
  const updatePayload: Record<string, unknown> = { signe: true, signe_le: new Date().toISOString() }
  if (sig_x !== undefined) updatePayload.sig_x = sig_x
  if (sig_y !== undefined) updatePayload.sig_y = sig_y
  if (sig_page !== undefined) updatePayload.sig_page = sig_page
  if (sig_image) updatePayload.sig_image_b64 = sig_image

  let { data: updatedRows, error: updateErr } = await admin
    .from('signataires').update(updatePayload).eq('id', signataire.id).eq('signe', false).select('id')

  if (updateErr && (sig_x !== undefined || sig_y !== undefined)) {
    const r2 = await admin
      .from('signataires').update({ signe: true, signe_le: new Date().toISOString() }).eq('id', signataire.id).eq('signe', false).select('id')
    updateErr = r2.error
    updatedRows = r2.data
  }

  if (updateErr) {
    console.error('[Signatures] Update signataire error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: true, allSigned: false })
  }

  const { allSigned } = await finalizeAfterSignature(admin, demandeId, demande, signerName, user.id)

  return NextResponse.json({ ok: true, allSigned })
}
