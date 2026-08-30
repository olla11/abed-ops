// Génération du PDF d'un TDR — extrait de l'ancienne route pour être
// appelable aussi bien depuis une requête utilisateur (aperçu/téléchargement)
// que depuis un traitement serveur sans session (email automatique envoyé à
// la signature finale du DE).

import { formatSignatureDisplayName } from '@/lib/signature-name'
import { CHAPITRE_CLES, labelSignataireRole, type Chapitre, type SignataireRole } from '@/lib/tdr'
import { sanitizeChapitreTexte } from '@/lib/tdr-sanitize'
import { PDF_BASE_STYLE, letterheadHtml } from '@/lib/contrat-pdf'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderTexte(texte: string | undefined): string {
  const propre = sanitizeChapitreTexte(texte).trim()
  if (!propre || propre === '<p></p>') return '<p class="muted">—</p>'
  return `<div class="rte-content">${propre}</div>`
}

function tableauEstVide(tableau: Chapitre['tableau']): tableau is undefined {
  if (!tableau || tableau.lignes.length === 0) return true
  return tableau.lignes.every(ligne => ligne.every(cell => !cell?.trim()))
}

function renderTableauInner(tableau: NonNullable<Chapitre['tableau']>): string {
  return `
    <table class="chapitre-table">
      <thead><tr>${tableau.colonnes.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${tableau.lignes.map(ligne => `<tr>${ligne.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
}

function renderChapitreTableau(c: Chapitre): string {
  const texteVide = !c.texte || !c.texte.trim() || c.texte === '<p></p>'
  const tabVide = tableauEstVide(c.tableau)
  if (texteVide && tabVide) return '<p class="muted">—</p>'
  return `${texteVide ? '' : renderTexte(c.texte)}${tabVide ? '' : renderTableauInner(c.tableau!)}`
}

function sigBlock(role: SignataireRole, signataire: any): string {
  const nomReel = signataire?.profile ? `${signataire.profile.prenoms} ${signataire.profile.nom}` : null
  const nomCursif = signataire?.profile && signataire.statut === 'signe'
    ? formatSignatureDisplayName(signataire.profile.prenoms, signataire.profile.nom)
    : null
  const dateStr = signataire?.signe_le ? new Date(signataire.signe_le).toLocaleDateString('fr-FR') : null

  let statutHtml = '<div class="sig-pending">En attente</div>'
  if (signataire?.statut === 'signe') {
    statutHtml = `<div class="sig-realname">${esc(nomReel)}</div><div class="sig-stamp">✓ Signé le ${dateStr}</div>`
  } else if (signataire?.statut === 'refuse') {
    statutHtml = `<div class="sig-refuse">✗ Refusé${dateStr ? ` le ${dateStr}` : ''}${signataire.commentaire ? `<br>« ${esc(signataire.commentaire)} »` : ''}</div>`
  } else if (nomReel) {
    statutHtml = `<div class="sig-pending">${esc(nomReel)}<br>En attente de signature</div>`
  }

  return `
    <div class="sig">
      <div class="sig-role">${labelSignataireRole(role, signataire?.profile?.civilite)}</div>
      <div class="sig-area">${nomCursif ? `<div class="sig-cursive">${esc(nomCursif)}</div>` : ''}</div>
      <div class="sig-rule"></div>
      ${statutHtml}
    </div>
  `
}

export function construireTdrHtml(tdr: any, exclureCles: Set<string> = new Set()): string {
  const apercu = tdr.statut !== 'actif' && tdr.statut !== 'cloture'
    && tdr.statut !== 'reconciliation_caf' && tdr.statut !== 'reconciliation_responsable'

  const chapitresOrdonnes: Chapitre[] = CHAPITRE_CLES
    .map(cle => (tdr.chapitres as Chapitre[]).find(c => c.cle === cle))
    .filter((c): c is Chapitre => !!c)
    .filter(c => !exclureCles.has(c.cle))

  const signataireParRole = (role: SignataireRole) =>
    (tdr.signataires as any[]).find(s => s.role === role)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>TdR ${esc(tdr.numero ?? '')} — ${esc(tdr.titre_activite)}</title>
<style>
  ${PDF_BASE_STYLE}
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #111827; padding: 0; margin: 0 auto; line-height: 1.55; max-width: 820px; }
  .apercu-banner { font-size: 10pt; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 14px; margin-bottom: 18px; font-family: Arial, sans-serif; }
  h1.titre-doc { text-align: center; font-size: 15pt; letter-spacing: 2px; margin: 0 0 18px; }
  .meta { background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 10.5pt; }
  .meta div { margin-bottom: 4px; }
  h2.chapitre-titre { font-size: 12.5pt; color: #14532d; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 28px 0 10px; break-after: avoid; page-break-after: avoid; }
  p { margin: 0 0 10px; text-align: justify; }
  ul { margin: 0 0 10px; padding-left: 22px; }
  .muted { color: #9ca3af; font-style: italic; }
  table.chapitre-table, .rte-content table {
    width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt;
    break-inside: avoid; page-break-inside: avoid;
  }
  table.chapitre-table th, table.chapitre-table td,
  .rte-content table th, .rte-content table td {
    border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top;
  }
  table.chapitre-table th, .rte-content table th { background: #f0fdf4; font-weight: bold; }
  table.chapitre-table thead, .rte-content table thead { display: table-header-row-group; }
  table.chapitre-table tr, .rte-content table tr { break-inside: avoid; page-break-inside: avoid; }
  .rte-content a { color: #2563eb; }
  .rte-content ul, .rte-content ol { margin: 0 0 10px; padding-left: 22px; }
  .sig-block { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 50px; page-break-inside: avoid; }
  .sig { text-align: center; }
  .sig-role { font-size: 9pt; font-weight: bold; line-height: 1.3; margin-bottom: 4px; min-height: 90px; display: flex; align-items: flex-end; justify-content: center; text-align: center; }
  .sig-area { min-height: 44px; margin-top: 20px; display: flex; align-items: flex-end; justify-content: center; }
  .sig-cursive { font-family: 'BrittanySignature', cursive; font-size: 22pt; line-height: 1; color: #1e3a8a; transform: translateY(-10px); }
  .sig-rule { border-top: 1px solid #000; }
  .sig-realname { font-size: 9.5pt; font-weight: bold; margin-top: 10px; color: #111; }
  .sig-pending { font-size: 9pt; color: #9ca3af; margin-top: 8px; }
  .sig-refuse { font-size: 8.5pt; color: #dc2626; margin-top: 8px; }
  .sig-stamp { font-size: 8pt; color: #16a34a; margin-top: 3px; font-weight: bold; }
  .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style>
</head>
<body>
  ${letterheadHtml()}

  <div class="page-content">
  ${apercu ? '<div class="apercu-banner">👁️ Aperçu — brouillon : les signatures manquantes apparaîtront une fois complétées.</div>' : ''}

  <h1 class="titre-doc">TERMES DE RÉFÉRENCE</h1>

  <div class="meta">
    <div><strong>N°</strong> ${esc(tdr.numero ?? '— (non encore attribué)')}</div>
    <div><strong>Activité :</strong> ${esc(tdr.titre_activite)}</div>
    ${tdr.projet ? `<div><strong>Projet :</strong> ${esc(tdr.projet)}</div>` : ''}
    ${tdr.periode ? `<div><strong>Date/Période :</strong> ${esc(tdr.periode)}</div>` : ''}
    <div><strong>Responsable :</strong> ${esc(tdr.initiateur?.prenoms)} ${esc(tdr.initiateur?.nom)}${tdr.initiateur?.fonction ? `, ${esc(tdr.initiateur.fonction)}` : ''}</div>
  </div>

  ${chapitresOrdonnes.map((c, i) => `
    <h2 class="chapitre-titre">${i + 1}. ${esc(c.titre)}</h2>
    ${c.type === 'tableau' ? renderChapitreTableau(c) : renderTexte(c.texte)}
  `).join('')}

  <h2 class="chapitre-titre">Approbation et autorisation</h2>
  <div class="sig-block">
    ${sigBlock('initiateur', signataireParRole('initiateur'))}
    ${sigBlock('responsable_technique', signataireParRole('responsable_technique'))}
    ${sigBlock('caf', signataireParRole('caf'))}
    ${sigBlock('de', signataireParRole('de'))}
  </div>

  <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion des TdR</div>
  </div>
</body>
</html>`
}

export async function genererTdrPdf(tdr: any, exclureCles: Set<string> = new Set()): Promise<Buffer> {
  const html = construireTdrHtml(tdr, exclureCles)
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
      // Les marges viennent des règles @page / @page:first du <style>
      // (marge du haut nulle uniquement sur la 1ère page, pour la bannière
      // à en-tête) — preferCSSPageSize fait primer ces règles sur cette option.
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

export function nomFichierTdrPdf(tdr: { numero: string | null; id: string }): string {
  return `TDR-${(tdr.numero ?? tdr.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}

// Requête standard pour charger un TDR avec tout ce dont le PDF a besoin —
// utilisable aussi bien avec le client utilisateur (RLS) qu'avec le client
// admin (service-role, pour l'envoi automatique par email).
export const TDR_PDF_SELECT = `*,
  initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms, fonction),
  signataires:tdr_signataires(role, statut, signe_le, commentaire, profile:profiles!tdr_signataires_profile_id_fkey(id, nom, prenoms, civilite))
`
