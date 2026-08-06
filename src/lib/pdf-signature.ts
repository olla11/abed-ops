import { PDFDocument } from 'pdf-lib'
import { createAdminClient } from './supabase-server'

/**
 * Embeds a pre-rendered signature PNG image into the PDF at the given position.
 * The PNG is captured from the browser's own canvas rendering (Brittany font included),
 * so the result in the PDF is pixel-perfect identical to the UI preview.
 */
export async function embedSignatureInPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
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

export function storagePathFromFichierUrl(fichierUrl: string): string | null {
  const path = fichierUrl.includes('/documents/') ? fichierUrl.split('/documents/').at(-1) : fichierUrl
  return path || null
}

/**
 * Reconstruit le PDF entièrement signé à la demande, à partir du fichier
 * original (jamais modifié après son upload initial) et de l'ensemble des
 * tampons enregistrés en base pour cette demande.
 *
 * Remplace volontairement l'ancienne approche qui mutait en place le PDF
 * partagé à chaque signature (download → incruster → upload, upsert) :
 * cette approche dépendait d'une cohérence stricte de lecture-après-écriture
 * du stockage entre chaque signataire, et a produit à plusieurs reprises des
 * documents finaux où une signature précédente disparaissait purement et
 * simplement — écrasée par un signataire suivant ayant lu une version
 * antérieure du fichier. En ne touchant plus jamais le fichier source et en
 * recomposant le résultat à chaque lecture depuis les données durables
 * (Postgres), cette classe de bug devient structurellement impossible.
 */
export async function composeSignedPdf(
  admin: ReturnType<typeof createAdminClient>,
  demandeId: string,
  fichierUrl: string
): Promise<Uint8Array | null> {
  const filePath = storagePathFromFichierUrl(fichierUrl)
  if (!filePath) return null

  const { data: fileData, error: downloadErr } = await admin.storage.from('documents').download(filePath)
  if (downloadErr || !fileData) {
    console.error('[composeSignedPdf] Téléchargement du PDF original impossible :', downloadErr)
    return null
  }

  const { data: stamps, error: stampsErr } = await admin
    .from('signataires')
    .select('sig_image_b64, sig_x, sig_y, sig_page, ordre')
    .eq('demande_id', demandeId)
    .eq('signe', true)
    .not('sig_image_b64', 'is', null)
    .order('ordre', { ascending: true })

  if (stampsErr) console.error('[composeSignedPdf] Lecture des tampons impossible :', stampsErr)

  let current: ArrayBuffer | Uint8Array = await fileData.arrayBuffer()
  for (const s of stamps ?? []) {
    if (!s.sig_image_b64 || s.sig_x == null || s.sig_y == null) continue
    try {
      current = await embedSignatureInPdf(current, s.sig_image_b64, s.sig_x, s.sig_y, (s.sig_page ?? 1) - 1)
    } catch (err) {
      console.error('[composeSignedPdf] Échec d\'incrustation d\'un tampon, poursuite avec les autres :', err)
    }
  }
  return current instanceof Uint8Array ? current : new Uint8Array(current)
}

/**
 * Fournit une URL signée vers le PDF à afficher : recompose et republie une
 * copie "aperçu" (chemin dédié, jamais le fichier original) dès qu'au moins
 * une signature existe, sinon renvoie directement l'original (rien à
 * recomposer). Cette copie aperçu est régénérée à chaque appel — une
 * éventuelle republication concurrente ne fait au pire que retarder d'un
 * appel la fraîcheur de l'aperçu affiché, sans jamais affecter les données
 * durables (signataires.sig_image_b64 + original intact) qui restent seules
 * source de vérité pour composeSignedPdf.
 */
export async function getComposedSignedUrl(
  admin: ReturnType<typeof createAdminClient>,
  demandeId: string,
  fichierUrl: string,
  ttlSeconds: number
): Promise<string | null> {
  const filePath = storagePathFromFichierUrl(fichierUrl)
  if (!filePath) return null

  const { count } = await admin
    .from('signataires')
    .select('id', { count: 'exact', head: true })
    .eq('demande_id', demandeId)
    .eq('signe', true)
    .not('sig_image_b64', 'is', null)

  if (!count) {
    const { data: signed, error } = await admin.storage.from('documents').createSignedUrl(filePath, ttlSeconds)
    if (error || !signed) {
      console.error('[getComposedSignedUrl] Signed URL (original) error:', error)
      return null
    }
    return signed.signedUrl
  }

  const composed = await composeSignedPdf(admin, demandeId, fichierUrl)
  if (!composed) return null

  const previewPath = `${filePath}.apercu.pdf`
  const { error: uploadErr } = await admin.storage
    .from('documents')
    .upload(previewPath, composed, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) {
    console.error('[getComposedSignedUrl] Upload aperçu error:', uploadErr)
    return null
  }

  const { data: signed, error: signErr } = await admin.storage.from('documents').createSignedUrl(previewPath, ttlSeconds)
  if (signErr || !signed) {
    console.error('[getComposedSignedUrl] Signed URL (aperçu) error:', signErr)
    return null
  }
  return signed.signedUrl
}
