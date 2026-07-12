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

export function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}
