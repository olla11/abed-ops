import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import { embedSignatureInPdf } from '@/lib/pdf-signature'
import { finalizeAfterSignature } from '@/lib/signature-completion'

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
    .select('id, demande_id, email, nom_externe, signe')
    .eq('id', payload.signataireId)
    .single()

  if (sigErr || !signataire || signataire.email !== payload.email) {
    return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  }
  if (signataire.signe) return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })
  if (!signataire.nom_externe) return NextResponse.json({ error: 'Veuillez d\'abord indiquer votre nom et prénom' }, { status: 400 })

  const { data: demande, error: demandeErr } = await admin
    .from('demandes_signature')
    .select('id, titre, statut, createur_id, fichier_url')
    .eq('id', signataire.demande_id)
    .single()

  if (demandeErr || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.statut === 'complete') return NextResponse.json({ error: 'Cette demande est déjà complète' }, { status: 400 })

  const signerName = signataire.nom_externe

  // Embed signature PNG image into the PDF at the chosen position
  if (demande.fichier_url && sig_x !== undefined && sig_y !== undefined && sig_image) {
    try {
      const rawFichierUrl = demande.fichier_url as string
      const filePath = rawFichierUrl.includes('/documents/') ? rawFichierUrl.split('/documents/').at(-1) : rawFichierUrl
      if (filePath) {
        const { data: fileData } = await admin.storage.from('documents').download(filePath)
        if (fileData) {
          const pdfBytes = await fileData.arrayBuffer()
          const signedPdf = await embedSignatureInPdf(pdfBytes, sig_image, sig_x, sig_y, (sig_page ?? 1) - 1)
          await admin.storage.from('documents').upload(filePath, signedPdf, { contentType: 'application/pdf', upsert: true })
        }
      }
    } catch (pdfErr) {
      console.error('[Sign externe] PDF embed error:', pdfErr)
      // Continue signing even if PDF embed fails
    }
  }

  const updatePayload: Record<string, unknown> = { signe: true, signe_le: new Date().toISOString() }
  if (sig_x !== undefined) updatePayload.sig_x = sig_x
  if (sig_y !== undefined) updatePayload.sig_y = sig_y
  if (sig_page !== undefined) updatePayload.sig_page = sig_page

  const { error: updateErr } = await admin.from('signataires').update(updatePayload).eq('id', signataire.id)
  if (updateErr) {
    console.error('[Signatures externe] Update signataire error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }

  const { allSigned } = await finalizeAfterSignature(admin, demande.id, demande, signerName, null)

  return NextResponse.json({ ok: true, allSigned })
}
