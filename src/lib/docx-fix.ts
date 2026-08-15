import JSZip from 'jszip'

/**
 * html-to-docx (v1.8.0) émet `<w:sectPr>` comme PREMIER enfant de `<w:body>`,
 * alors que le schéma OOXML exige qu'il soit le DERNIER enfant (il décrit la
 * section finale du document). Word refuse d'ouvrir un tel fichier
 * ("Word a rencontré une erreur lors de l'ouverture du fichier") même si le
 * zip et le XML sont par ailleurs bien formés — un lecteur plus permissif
 * (LibreOffice, un simple parseur XML) ne le remarque pas, ce qui rend le
 * bug facile à manquer en testant autrement qu'avec Word lui-même. On
 * déplace ce bloc à la fin après coup, directement dans le zip généré.
 */
export async function fixDocxSectionOrder(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer)
  const docXmlFile = zip.file('word/document.xml')
  if (!docXmlFile) return buffer

  const xml = await docXmlFile.async('string')
  const match = xml.match(/<w:body>\s*(<w:sectPr\b[\s\S]*?<\/w:sectPr>)\s*/)
  if (!match) return buffer

  const sectPr = match[1]
  const fixed = xml.replace(match[0], '<w:body>').replace('</w:body>', `${sectPr}</w:body>`)
  zip.file('word/document.xml', fixed)

  const out = await zip.generateAsync({ type: 'nodebuffer' })
  return out
}
