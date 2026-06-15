import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

// Embed signature visually into the PDF using pdf-lib
async function embedSignatureInPdf(
  pdfBytes: ArrayBuffer,
  signerName: string,
  sigDate: string,
  sigHash: string,
  xPct: number,   // 0-100 percentage from left
  yPct: number,   // 0-100 percentage from top
  pageIndex = 0
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const { width, height } = page.getSize()

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Convert percentage to PDF coordinates (PDF origin = bottom-left)
  const sigW = 160
  const sigH = 52
  const x = (xPct / 100) * width - sigW / 2
  const y = height - (yPct / 100) * height - sigH / 2

  const clampX = Math.max(4, Math.min(width - sigW - 4, x))
  const clampY = Math.max(4, Math.min(height - sigH - 4, y))

  // DocuSign-style bracket: left vertical bar + top/bottom hooks
  const barX = clampX + 4
  const barTop = clampY + sigH
  const barBot = clampY
  const hookLen = 8

  // Left bracket (C shape)
  page.drawLine({ start: { x: barX, y: barTop }, end: { x: barX + hookLen, y: barTop }, thickness: 1.2, color: rgb(0.1, 0.1, 0.1) })
  page.drawLine({ start: { x: barX, y: barTop }, end: { x: barX, y: barBot }, thickness: 1.2, color: rgb(0.1, 0.1, 0.1) })
  page.drawLine({ start: { x: barX, y: barBot }, end: { x: barX + hookLen, y: barBot }, thickness: 1.2, color: rgb(0.1, 0.1, 0.1) })

  // "MyABED signed by:" header
  page.drawText('MyABED signed by:', {
    x: barX + 14, y: clampY + sigH - 11,
    size: 6.5, font: helveticaBold, color: rgb(0.15, 0.15, 0.15),
  })

  // Signer name in italic (simulates handwriting)
  const nameSize = signerName.length > 16 ? 14 : 17
  page.drawText(signerName, {
    x: barX + 14, y: clampY + sigH - 30,
    size: nameSize, font: helveticaFont, color: rgb(0, 0, 0),
  })

  // Separator line
  page.drawLine({
    start: { x: barX + 14, y: clampY + 13 },
    end: { x: clampX + sigW - 4, y: clampY + 13 },
    thickness: 0.5, color: rgb(0.7, 0.7, 0.7),
  })

  // Date + hash
  page.drawText(sigDate, { x: barX + 14, y: clampY + 5, size: 5.5, font: helvetica, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(`${sigHash.slice(0, 12)}...`, { x: barX + 70, y: clampY + 5, size: 5.5, font: helvetica, color: rgb(0.4, 0.4, 0.4) })

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
  try {
    const body = await req.json()
    if (typeof body.sig_x === 'number') sig_x = body.sig_x
    if (typeof body.sig_y === 'number') sig_y = body.sig_y
    if (typeof body.sig_page === 'number') sig_page = body.sig_page
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

  // Embed signature in PDF if file exists and position provided
  let newFichierUrl: string | null = null
  if (demande.fichier_url && sig_x !== undefined && sig_y !== undefined) {
    try {
      const filePath = (demande.fichier_url as string).split('/documents/').at(-1)
      if (filePath) {
        // Download current PDF
        const { data: fileData } = await admin.storage.from('documents').download(filePath)
        if (fileData) {
          const pdfBytes = await fileData.arrayBuffer()
          const signedPdf = await embedSignatureInPdf(
            pdfBytes, signerName, sigDate, sigHash,
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
