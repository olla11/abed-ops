import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// Habille le HTML issu de mammoth/xlsx dans une page imprimable — même
// esprit que le rendu TDR (src/app/api/tdrs/[id]/pdf/route.ts), mais sans
// logo ni signataires : ce n'est qu'une conversion de mise en forme.
function wrapHtml(bodyHtml: string, titre: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${titre}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #111; line-height: 1.5; }
  h1, h2, h3 { color: #1f2937; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  td, th { border: 1px solid #999; padding: 4px 8px; font-size: 11px; }
  th { background: #f0f0f0; }
  img { max-width: 100%; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.convertToHtml({ buffer })
  return value
}

async function convertSpreadsheetToHtml(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    const html = XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' })
    return `<h2>${name}</h2>${html}`
  }).join('<div style="page-break-before: always;"></div>')
}

/**
 * Convertit un document Word (.docx) ou Excel (.xls/.xlsx) en PDF, en passant
 * par un rendu HTML intermédiaire (mammoth / SheetJS) puis Puppeteer — la
 * mise en page n'est pas garantie identique à l'original (pas de conversion
 * "print natif" façon LibreOffice), mais le texte, les tableaux et la mise
 * en forme de base sont préservés, ce qui suffit pour un aperçu + une
 * signature fiables. Retourne null si l'extension n'est pas supportée
 * (ex: .doc, ancien format binaire que mammoth ne sait pas lire).
 */
export async function convertOfficeToPdf(buffer: Buffer, filename: string, titre: string): Promise<Buffer | null> {
  const ext = filename.toLowerCase().split('.').pop()

  let bodyHtml: string
  if (ext === 'docx') {
    bodyHtml = await convertDocxToHtml(buffer)
  } else if (ext === 'xlsx' || ext === 'xls') {
    bodyHtml = await convertSpreadsheetToHtml(buffer)
  } else {
    return null
  }

  return renderHtmlToPdf(bodyHtml, titre)
}

/**
 * Rend un fragment HTML (déjà au format body — issu de mammoth, de l'éditeur
 * collaboratif Documents, etc.) en PDF via Puppeteer. Extrait de
 * convertOfficeToPdf pour être réutilisé par le verrouillage d'un document
 * collaboratif avant signature (src/app/api/documents/[id]/verrouiller).
 */
export async function renderHtmlToPdf(bodyHtml: string, titre: string): Promise<Buffer> {
  const html = wrapHtml(bodyHtml, titre)

  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;text-align:center;color:#888;font-family:Georgia,'Times New Roman',serif;">
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

export function isOfficeConvertible(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  return ext === 'docx' || ext === 'xlsx' || ext === 'xls'
}
