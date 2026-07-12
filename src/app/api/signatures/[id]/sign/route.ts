import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { embedSignatureInPdf, shortHash } from '@/lib/pdf-signature'
import { finalizeAfterSignature } from '@/lib/signature-completion'

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
    .select('id, titre, statut, createur_id, fichier_url')
    .eq('id', demandeId)
    .single()

  if (demandeErr || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.statut === 'complete') return NextResponse.json({ error: 'Cette demande est déjà complète' }, { status: 400 })

  const { data: signataire, error: sigErr } = await admin
    .from('signataires')
    .select('id, signe')
    .eq('demande_id', demandeId)
    .eq('profile_id', user.id)
    .single()

  if (sigErr || !signataire) return NextResponse.json({ error: "Vous n'êtes pas signataire de ce document" }, { status: 403 })
  if (signataire.signe) return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })

  // Get signer name
  const { data: signerProfile } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const signerName = signerProfile ? `${signerProfile.prenoms} ${signerProfile.nom}` : 'Signataire'
  const sigDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(user.id + demandeId + sigDate)

  // Embed signature PNG image into the PDF at the chosen position
  let newFichierUrl: string | null = null
  if (demande.fichier_url && sig_x !== undefined && sig_y !== undefined && sig_image) {
    try {
      const rawFichierUrl = demande.fichier_url as string
      const filePath = rawFichierUrl.includes('/documents/') ? rawFichierUrl.split('/documents/').at(-1) : rawFichierUrl
      if (filePath) {
        // Download current PDF
        const { data: fileData } = await admin.storage.from('documents').download(filePath)
        if (fileData) {
          const pdfBytes = await fileData.arrayBuffer()
          const signedPdf = await embedSignatureInPdf(
            pdfBytes, sig_image,
            sig_x, sig_y, (sig_page ?? 1) - 1
          )
          // Upload signed PDF (overwrite)
          const { error: uploadErr } = await admin.storage
            .from('documents')
            .upload(filePath, signedPdf, { contentType: 'application/pdf', upsert: true })

          if (!uploadErr) {
            // Keep the same URL (file is overwritten in place)
            newFichierUrl = demande.fichier_url as string
          }
        }
      }
    } catch (pdfErr) {
      console.error('[Sign] PDF embed error:', pdfErr)
      // Continue signing even if PDF embed fails
    }
  }

  // Update signataire
  const updatePayload: Record<string, unknown> = { signe: true, signe_le: new Date().toISOString() }
  if (sig_x !== undefined) updatePayload.sig_x = sig_x
  if (sig_y !== undefined) updatePayload.sig_y = sig_y
  if (sig_page !== undefined) updatePayload.sig_page = sig_page

  let { error: updateErr } = await admin.from('signataires').update(updatePayload).eq('id', signataire.id)

  if (updateErr && (sig_x !== undefined || sig_y !== undefined)) {
    const r2 = await admin.from('signataires').update({ signe: true, signe_le: new Date().toISOString() }).eq('id', signataire.id)
    updateErr = r2.error
  }

  if (updateErr) {
    console.error('[Signatures] Update signataire error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }

  const { allSigned } = await finalizeAfterSignature(admin, demandeId, demande, signerName, user.id)

  return NextResponse.json({ ok: true, allSigned })
}
