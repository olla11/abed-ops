// Conversion d'un Word uploadé en HTML éditable, pour entrer dans le même
// éditeur collaboratif que les TDR (mammoth garde la mise en forme). Le PDF
// a été retiré des formats acceptés en entrée : un PDF aplatit la mise en
// page en texte brut à la conversion, ce qui donnait un point de départ de
// rédaction dégradé — un document vierge ou un Word donnent un meilleur départ.

async function convertirDocxEnHtml(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.convertToHtml({ buffer })
  return value
}

export function formatConvertible(filename: string): 'docx' | null {
  const ext = filename.toLowerCase().split('.').pop()
  return ext === 'docx' ? 'docx' : null
}

/**
 * Convertit un fichier uploadé en HTML éditable. Retourne null si le format
 * n'est pas pris en charge (seul le .docx l'est pour ce module).
 */
export async function convertirEnHtmlEditable(buffer: Buffer, filename: string): Promise<string | null> {
  const format = formatConvertible(filename)
  if (format === 'docx') return convertirDocxEnHtml(buffer)
  return null
}
