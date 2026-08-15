// Conversion d'un document uploadé (Word ou PDF) en HTML éditable, pour
// entrer dans le même éditeur collaboratif que les TDR. Un Word garde sa
// mise en forme (mammoth). Un PDF est reconstitué en paragraphes de texte
// simple (choix assumé : édition collaborative fiable plutôt que fidélité
// de mise en page — la mise en page d'origine peut se déplacer ou disparaître,
// notamment tableaux et zones de texte).

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function convertirDocxEnHtml(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.convertToHtml({ buffer })
  return value
}

async function convertirPdfEnHtml(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const { text } = await pdfParse(buffer)
  const paragraphes = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (paragraphes.length === 0) return '<p></p>'
  return paragraphes.map(p => `<p>${escHtml(p)}</p>`).join('')
}

export function formatConvertible(filename: string): 'docx' | 'pdf' | null {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  return null
}

/**
 * Convertit un fichier uploadé en HTML éditable. Retourne null si le format
 * n'est pas pris en charge (ex: .doc, .xlsx — pas encore couverts par ce
 * module de révision collaborative).
 */
export async function convertirEnHtmlEditable(buffer: Buffer, filename: string): Promise<string | null> {
  const format = formatConvertible(filename)
  if (format === 'docx') return convertirDocxEnHtml(buffer)
  if (format === 'pdf') return convertirPdfEnHtml(buffer)
  return null
}
