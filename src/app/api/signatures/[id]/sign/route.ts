import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { PDFDocument } from 'pdf-lib'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

/**
 * Embeds a pre-rendered signature PNG image into the PDF at the given position.
 * The PNG is captured from the browser's own canvas rendering (Brittany font included),
 * so the result in the PDF is pixel-perfect identical to the UI preview.
 */
async function embedSignatureInPdf(
  pdfBytes: ArrayBuffer,
  sigImagePng: string,  // base64 data URL: "data:image/png;base64,..."
  xPct: number,         // 0-100 % from left (center of signature block)
  yPct: number,         // 0-100 % from top  (center of signature block)
  pageIndex = 0
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const { width, height } = page.getSize()

  // Decode the PNG
  const base64 = sigImagePng.replace(/^data:image\/png;base64,/, '')
  const pngBytes = Buffer.from(base64, 'base64')
  const pngImage = await pdfDoc.embedPng(pngBytes)

  // Maintain the same aspect ratio as the UI block (240 × 90)
  const sigW = width * 0.30        // ~30% of page width
  const sigH = sigW * (90 / 240)   // preserve 240:90 aspect ratio

  // Convert % from top to PDF coords (origin = bottom-left)
  const cx = (xPct / 100) * width
  const cy = height - (yPct / 100) * height

  const drawX = Math.max(2, Math.min(width - sigW - 2, cx - sigW / 2))
  const drawY = Math.max(2, Math.min(height - sigH - 2, cy - sigH / 2))

  page.drawImage(pngImage, { x: drawX, y: drawY, width: sigW, height: sigH })

  return pdfDoc.save()
}

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

  // Check if all signed
  const { data: allSigs } = await admin.from('signataires').select('signe').eq('demande_id', demandeId)
  const allSigned = allSigs?.every(s => s.signe) ?? false

  if (allSigned) {
    await admin.from('demandes_signature').update({ statut: 'complete', updated_at: new Date().toISOString() }).eq('id', demandeId)

    const { data: createur } = await admin.from('profiles').select('nom, prenoms, email').eq('id', demande.createur_id).single()
    if (createur?.email) {
      await sendEmail({
        to: createur.email,
        subject: `My ABED — Document entièrement signé : ${demande.titre}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">My ABED — Toutes les signatures recueillies ✓</h2>
          <p>Bonjour <strong>${createur.prenoms} ${createur.nom}</strong>,</p>
          <p>Tous les signataires ont signé le document <strong>${demande.titre}</strong>.</p>
          <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">Voir le document</a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
        </div>`,
      }).catch(err => console.error('[Signatures] Creator email error:', err))
    }
  }

  return NextResponse.json({ ok: true, allSigned })
}
