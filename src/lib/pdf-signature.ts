import { PDFDocument } from 'pdf-lib'

/**
 * Embeds a pre-rendered signature PNG image into the PDF at the given position.
 * The PNG is captured from the browser's own canvas rendering (Brittany font included),
 * so the result in the PDF is pixel-perfect identical to the UI preview.
 */
export async function embedSignatureInPdf(
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

  // La largeur du PNG capturé varie désormais selon la longueur du nom signé
  // (voir captureSignatureImage côté client), mais sa hauteur reste toujours
  // fixe (même échelle de police pour tout le monde). On calibre donc
  // l'échelle sur une largeur de référence — celle d'un nom "standard" —
  // pour que la hauteur affichée reste constante quel que soit le nom, tout
  // en laissant la largeur réellement apposée se réduire pour un nom court.
  const REF_BW = 720  // largeur nominale de référence (240 × échelle 3× côté capture)
  const scale = (width * 0.20) / REF_BW
  const sigW = pngImage.width * scale
  const sigH = pngImage.height * scale

  // Convert % from top to PDF coords (origin = bottom-left)
  const cx = (xPct / 100) * width
  const cy = height - (yPct / 100) * height

  const drawX = Math.max(2, Math.min(width - sigW - 2, cx - sigW / 2))
  const drawY = Math.max(2, Math.min(height - sigH - 2, cy - sigH / 2))

  page.drawImage(pngImage, { x: drawX, y: drawY, width: sigW, height: sigH })

  return pdfDoc.save()
}

export function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}
