// Génération du PDF "Bon de commande" — même rendu Chromium headless que
// les autres documents officiels ABED-ONG (contrat-pdf.ts,
// appel-de-fonds-pdf.ts). La zone de signature reste vide et étiquetée : le
// tampon réel (DE ou PCA, selon le montant) est superposé plus tard par le
// système générique de signature (demandes_signature/signataires).
import { PDF_BASE_STYLE, letterheadHtml } from '@/lib/contrat-pdf'
import { nombreEnLettresFr } from '@/lib/nombre-en-lettres'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface BonDeCommandeLignePdf {
  jour: string
  designation: string
  quantite: number
  prixUnitaire: number
  montant: number
}

export interface BonDeCommandePdfData {
  numero: string
  date: string
  fournisseurNom: string
  fournisseurRccm: string | null
  fournisseurIfu: string | null
  fournisseurTelephone: string | null
  objet: string
  lignes: BonDeCommandeLignePdf[]
  montantTotal: number
  dateLivraisonSouhaitee: string | null
  signataireTitre: string
  codeBudgetaire: string | null
  referenceLabel: string | null
}

const BC_STYLE = `
  .bc-box { border: 1.5px solid #111; padding: 8px 14px; font-weight: 700; font-size: 12pt; margin-bottom: 16px; }
  .bc-fournisseur { margin-bottom: 14px; font-size: 10.5pt; line-height: 1.7; }
  .bc-fournisseur b { text-decoration: underline; }
  .bc-objet { margin-bottom: 14px; font-size: 10.5pt; }
  table.bc-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt; }
  table.bc-table th, table.bc-table td { border: 1px solid #111; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.bc-table th { background: #f4b93e; font-weight: 700; text-align: center; }
  table.bc-table td.num { text-align: right; white-space: nowrap; }
  table.bc-table td.center { text-align: center; }
  table.bc-table tr.total td { font-weight: 700; background: #f4b93e; text-align: center; }
  .bc-lettres { margin-bottom: 12px; font-size: 10pt; }
  .bc-livraison { margin-bottom: 24px; font-size: 10pt; }
  .bc-date-lieu { text-align: right; margin-bottom: 40px; font-size: 10pt; }
  .bc-signature { width: 260px; margin-left: auto; text-align: center; }
  .bc-signature-zone { height: 90px; border-bottom: 1px solid #111; margin-bottom: 6px; }
`

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

export function construireBonDeCommandeHtml(d: BonDeCommandePdfData): string {
  const lignesHtml = d.lignes.map(l => `
    <tr>
      <td class="center">${l.jour}</td>
      <td>${l.designation}</td>
      <td class="center">${l.quantite}</td>
      <td class="num">${fmt(l.prixUnitaire)}</td>
      <td class="num"><strong>${fmt(l.montant)}</strong></td>
    </tr>`).join('')

  const montantLettres = `${nombreEnLettresFr(d.montantTotal)} francs CFA`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de commande N° ${d.numero} — ABED-ONG</title>
  <style>${PDF_BASE_STYLE}${BC_STYLE}</style>
</head>
<body>
  ${letterheadHtml()}
  <div class="page-content">
    <div style="text-align:center;font-weight:700;font-size:13pt;margin:6px 0 16px;">
      BON DE COMMANDE N° ${d.numero}
    </div>

    <div class="bc-fournisseur">
      <b>${d.fournisseurNom}</b><br/>
      ${d.fournisseurRccm ? `RCCM : ${d.fournisseurRccm}<br/>` : ''}
      ${d.fournisseurIfu ? `IFU : ${d.fournisseurIfu}<br/>` : ''}
      ${d.fournisseurTelephone ? `Téléphone : ${d.fournisseurTelephone}` : ''}
    </div>

    <div class="bc-objet"><u>OBJET</u> : ${d.objet}</div>
    ${d.codeBudgetaire ? `<div class="bc-objet"><u>CODE BUDGÉTAIRE</u> : ${d.codeBudgetaire}</div>` : ''}
    ${d.referenceLabel ? `<div class="bc-objet"><u>RÉFÉRENCE</u> : ${d.referenceLabel}</div>` : ''}

    <table class="bc-table">
      <thead>
        <tr>
          <th style="width:60px;">N°</th>
          <th>Désignation</th>
          <th style="width:80px;">Quantité</th>
          <th style="width:120px;">Prix unitaire<br/>(FCFA)</th>
          <th style="width:120px;">Montant<br/>(FCFA)</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHtml}
        <tr class="total">
          <td colspan="4">TOTAL (FCFA)</td>
          <td class="num">${fmt(d.montantTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="bc-lettres">Arrêter le présent bon de commande à la somme de <strong>${montantLettres}</strong>.</div>
    ${d.dateLivraisonSouhaitee ? `<div class="bc-livraison"><u>Date de livraison souhaitée</u> : ${d.dateLivraisonSouhaitee}</div>` : ''}

    <div class="bc-date-lieu">Parakou, le ${d.date}</div>

    <div class="bc-signature">
      <div class="bc-signature-zone"></div>
      <div style="font-style:italic;">${d.signataireTitre}</div>
    </div>

    <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion financière</div>
  </div>
</body>
</html>`
}

export async function genererBonDeCommandePdf(d: BonDeCommandePdfData): Promise<Buffer> {
  const html = construireBonDeCommandeHtml(d)
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;text-align:center;color:#888;font-family:Georgia,'Times New Roman',serif;padding-bottom:6px;">
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
