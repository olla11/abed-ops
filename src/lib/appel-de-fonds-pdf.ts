// Génération du PDF "Appel de fonds" — même rendu Chromium headless que les
// autres documents officiels ABED-ONG (contrat-pdf.ts, tdr-pdf.ts), réutilise
// le même en-tête (letterheadHtml/PDF_BASE_STYLE). Les zones de signature
// restent des cellules vides et étiquetées : le tampon réel (DE / TG CA /
// PCA) est superposé plus tard par le système générique de signature
// (demandes_signature/signataires), pas baké ici à la génération.

import { PDF_BASE_STYLE, letterheadHtml } from '@/lib/contrat-pdf'
import { nombreEnLettresFr } from '@/lib/nombre-en-lettres'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface AppelDeFondsLignePdf {
  libelle: string
  montantPrevu: number
  realisationCumulee: number
  disponibilite: number
  montantDemande: number
  commentaire: string
}

export interface AppelDeFondsPdfData {
  numero: string
  date: string
  lignes: AppelDeFondsLignePdf[]
  montantTotal: number
  consommationGlobalePct: number
}

const AFD_TABLE_STYLE = `
  .afd-box { border: 1.5px solid #111; padding: 8px 14px; font-weight: 700; font-size: 12pt; margin-bottom: 14px; }
  .afd-date { border: 1px solid #111; padding: 8px 14px; margin-bottom: 14px; font-size: 10.5pt; }
  table.afd-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; }
  table.afd-table th, table.afd-table td { border: 1px solid #111; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.afd-table th { background: #f4b93e; font-weight: 700; text-align: center; }
  table.afd-table td.num { text-align: right; white-space: nowrap; }
  table.afd-table tr.total td { font-weight: 700; background: #f4b93e; }
  .afd-conso { font-weight: 700; font-size: 10.5pt; margin-bottom: 10px; }
  .afd-lettres { font-style: italic; font-size: 10pt; margin-bottom: 16px; }
  table.afd-sig-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.afd-sig-table th, table.afd-sig-table td { border: 1px solid #111; padding: 8px 10px; vertical-align: top; }
  table.afd-sig-table th { background: #f4b93e; text-align: center; }
  .afd-sig-cell { height: 90px; }
`

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

export function construireAppelDeFondsHtml(d: AppelDeFondsPdfData): string {
  const lignesHtml = d.lignes.map((l, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${l.libelle}</td>
      <td class="num">${l.montantPrevu ? fmt(l.montantPrevu) : '-'}</td>
      <td class="num">${l.realisationCumulee ? fmt(l.realisationCumulee) : '-'}</td>
      <td class="num">${l.disponibilite ? fmt(l.disponibilite) : '-'}</td>
      <td class="num"><strong>${fmt(l.montantDemande)}</strong></td>
      <td>${l.commentaire || ''}</td>
    </tr>`).join('')

  const montantLettres = `${nombreEnLettresFr(d.montantTotal)} francs CFA`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Appel de fonds N° ${d.numero} — ABED-ONG</title>
  <style>${PDF_BASE_STYLE}${AFD_TABLE_STYLE}</style>
</head>
<body>
  ${letterheadHtml()}
  <div class="page-content">
    <div style="text-align:center;font-weight:700;font-size:12pt;margin:6px 0 16px;text-transform:uppercase;">
      Direction de l'Administration et des Finances
    </div>
    <div class="afd-box">APPEL DE FONDS N° ${d.numero} /ABED/DE</div>
    <div class="afd-date">DATE : ${d.date}</div>

    <table class="afd-table">
      <thead>
        <tr>
          <th>N°</th>
          <th>Ligne Budgétaire</th>
          <th>Montant Prévu<br/>(FCFA)</th>
          <th>Réalisation Cumulée<br/>(FCFA)</th>
          <th>Disponibilité Actuelle<br/>(FCFA)</th>
          <th>Montant Demandé<br/>(FCFA)</th>
          <th>Commentaires</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHtml}
        <tr class="total">
          <td colspan="5" style="text-align:right;">TOTAL</td>
          <td class="num">${fmt(d.montantTotal)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="afd-conso">Consommation globale du budget : ${d.consommationGlobalePct.toFixed(1)}%</div>
    <div class="afd-lettres">Arrêté la présente demande à la somme de ${montantLettres}.</div>

    <table class="afd-sig-table">
      <thead>
        <tr><th style="width:40px;">N°</th><th>Référence</th><th style="width:120px;">Montant</th><th colspan="3">Signatures</th></tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:center;">1</td>
          <td>Chèque N° ……………………</td>
          <td class="num">${fmt(d.montantTotal)}</td>
          <td style="width:33%;"><strong>Demandée par la DE</strong><div class="afd-sig-cell"></div></td>
          <td style="width:33%;"><strong>Contrôlée par la TG CA</strong><div class="afd-sig-cell"></div></td>
          <td style="width:33%;"><strong>Ordonnée par le PCA</strong><div class="afd-sig-cell"></div></td>
        </tr>
      </tbody>
    </table>

    <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion financière</div>
  </div>
</body>
</html>`
}

export async function genererAppelDeFondsPdf(d: AppelDeFondsPdfData): Promise<Buffer> {
  const html = construireAppelDeFondsHtml(d)
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
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
