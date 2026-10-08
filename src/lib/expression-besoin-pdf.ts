// Génération du PDF "Fiche d'expression de besoin" — même rendu Chromium
// headless que les autres documents officiels ABED-ONG (bon-de-commande-pdf.ts,
// tdr-reconciliation-pdf.ts), avec un bloc de 3 visas (Demandeur / Comptable-AAF
// / Directrice Exécutive) sur le même modèle que tdr-reconciliation-pdf.ts.
import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'
import { nombreEnLettresFr } from '@/lib/nombre-en-lettres'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface ExpressionBesoinLignePdf {
  designation: string
  quantite: string
  montantEstime: number
  reference: string
}

export interface ExpressionBesoinPdfData {
  numero: string
  date: string
  projetService: string
  nomDemandeur: string
  fonction: string | null
  contact: string | null
  natureDepense: string
  codeBudgetaire: string
  refTdr: string | null
  lignes: ExpressionBesoinLignePdf[]
  montantTotal: number
  demandeurNom: string
  demandeurLe: string | null
  aafNom: string | null
  aafLe: string | null
  deNom: string | null
  deLe: string | null
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

function sigBlock(role: string, nom: string, dateStr: string | null): string {
  return `
    <div class="sig">
      <div class="sig-role">${esc(role)}</div>
      <div class="sig-rule"></div>
      <div class="sig-realname">${esc(nom)}</div>
      <div class="sig-stamp">${dateStr ? `✓ Signé le ${esc(dateStr)}` : ''}</div>
    </div>
  `
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #111827; padding: 0; margin: 0; line-height: 1.5; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #166534; padding-bottom: 14px; margin-bottom: 16px; }
  .header img { height: 60px; }
  .org-text { text-align: center; flex: 1; }
  .org-name { font-size: 11pt; font-weight: bold; color: #166534; }
  .org-sub { font-size: 8pt; color: #555; margin-top: 4px; }
  h1.titre-doc { text-align: center; font-size: 14.5pt; letter-spacing: 1px; margin: 0 0 4px; background: #166534; color: white; padding: 8px; border-radius: 4px; }
  .numero-date { text-align: center; font-size: 10pt; margin-bottom: 18px; color: #374151; }
  h2.section-titre { font-size: 11pt; color: white; background: #166534; padding: 5px 10px; margin: 0 0 0; border-radius: 4px 4px 0 0; }
  .meta { border: 1px solid #a7d7a7; border-top: none; padding: 12px 16px; margin-bottom: 18px; font-size: 10.5pt; background: #f0fdf4; }
  .meta div { margin-bottom: 4px; }
  table.lignes { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 9.5pt; }
  table.lignes th, table.lignes td { border: 1px solid #a7d7a7; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.lignes th { background: #166534; color: white; font-weight: 700; text-align: center; }
  table.lignes td.num { text-align: right; white-space: nowrap; }
  table.lignes td.center { text-align: center; }
  table.lignes tr.total td { font-weight: 700; background: #dcfce7; text-align: center; }
  .lettres { margin-bottom: 30px; font-size: 10pt; }
  .sig-block { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 40px; page-break-inside: avoid; }
  .sig { text-align: center; }
  .sig-role { font-size: 9pt; font-weight: bold; margin-bottom: 30px; min-height: 26px; }
  .sig-rule { border-top: 1px solid #000; }
  .sig-realname { font-size: 9.5pt; font-weight: bold; margin-top: 10px; color: #111; }
  .sig-stamp { font-size: 8pt; color: #166534; margin-top: 3px; font-weight: bold; }
  .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
`

export function construireExpressionBesoinHtml(d: ExpressionBesoinPdfData): string {
  const lignesHtml = d.lignes.map((l, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${esc(l.designation)}</td>
      <td class="center">${esc(l.quantite)}</td>
      <td class="num">${fmt(l.montantEstime)}</td>
      <td>${esc(l.reference)}</td>
    </tr>`).join('')

  const montantLettres = `${nombreEnLettresFr(d.montantTotal)} francs CFA`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Fiche d'expression de besoin N° ${esc(d.numero)} — ABED-ONG</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">ABED-ONG</div>
      <div class="org-sub">Direction de l'Administration et des Finances (DAF) — Comptabilité<br>Parakou, Quartier Zongo, Bénin · Tél. : +229 0167779141 · contact@abedong.org</div>
    </div>
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
  </div>

  <h1 class="titre-doc">FICHE D'EXPRESSION DE BESOIN</h1>
  <div class="numero-date">N° : <strong>${esc(d.numero)}</strong> &nbsp;·&nbsp; Date : ${esc(d.date)}</div>

  <h2 class="section-titre">1. Informations générales</h2>
  <div class="meta">
    <div><strong>Projet / Service demandeur :</strong> ${esc(d.projetService)}</div>
    <div><strong>Nom du demandeur :</strong> ${esc(d.nomDemandeur)}</div>
    <div><strong>Fonction :</strong> ${esc(d.fonction) || '—'} &nbsp;&nbsp; <strong>Contact :</strong> ${esc(d.contact) || '—'}</div>
    <div><strong>Nature de la dépense :</strong> ${esc(d.natureDepense)}</div>
    <div><strong>Ligne / Code budgétaire :</strong> ${esc(d.codeBudgetaire)} &nbsp;&nbsp; <strong>Réf. TDR :</strong> ${esc(d.refTdr) || '—'}</div>
  </div>

  <h2 class="section-titre">2. Détail des besoins</h2>
  <table class="lignes">
    <thead>
      <tr>
        <th style="width:36px;">N°</th>
        <th>Désignation</th>
        <th style="width:70px;">Quantité</th>
        <th style="width:120px;">Montant estimé<br/>(FCFA)</th>
        <th style="width:120px;">Référence</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHtml}
      <tr class="total">
        <td colspan="3">TOTAL (FCFA)</td>
        <td class="num">${fmt(d.montantTotal)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="lettres">Arrêté la présente fiche à la somme de <strong>${montantLettres}</strong>.</div>

  <h2 class="section-titre" style="background:none;color:#166534;padding:0;">4. Visas et approbations</h2>
  <div class="sig-block">
    ${sigBlock('Visa du Demandeur', d.demandeurNom, d.demandeurLe)}
    ${sigBlock('Visa du Comptable / AAF', d.aafNom ?? '—', d.aafLe)}
    ${sigBlock('Visa de la Directrice Exécutive', d.deNom ?? '—', d.deLe)}
  </div>

  <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion financière</div>
</body>
</html>`
}

export async function genererExpressionBesoinPdf(d: ExpressionBesoinPdfData): Promise<Buffer> {
  const html = construireExpressionBesoinHtml(d)
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
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

export function nomFichierExpressionBesoinPdf(numero: string, id: string): string {
  return `Expression-besoin-${(numero || id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}
