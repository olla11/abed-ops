// Génération du PDF du rapport de réconciliation financière d'un TDR — le
// document produit une fois AAF/CAF/responsable ont tous signé le suivi
// financier, sur le même principe que le PDF du TDR lui-même (tdr-pdf.ts).

import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'
import { EXECUTION_STATUT_LABELS } from '@/lib/tdr'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

type ProfileNom = { nom: string; prenoms: string } | null

type TdrReconciliation = {
  id: string
  numero: string | null
  titre_activite: string
  projet: string | null
  code_budgetaire: string | null
  date_debut_prevue: string | null
  date_fin_prevue: string | null
  budget_total_valide: number | null
  montant_depense: number | null
  execution_statut: 'complete' | 'partielle' | null
  rapport_reconciliation_texte: string | null
  reconciliation_soumis_le: string | null
  reconciliation_caf_signe_le: string | null
  reconciliation_responsable_signe_le: string | null
  cloture_le: string | null
  initiateur: (ProfileNom & { fonction?: string | null }) | null
  reconciliation_soumis_par_profile: ProfileNom
  reconciliation_caf_signe_par_profile: ProfileNom
}

type Facture = { description: string; montant: number; date_facture: string | null; enregistre_par: ProfileNom }

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

function fmtMontant(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('fr-FR') + ' FCFA'
}

function nomComplet(p: ProfileNom): string {
  return p ? `${p.prenoms} ${p.nom}` : '—'
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

export function construireReconciliationHtml(tdr: TdrReconciliation, factures: Facture[]): string {
  const budgetTotal = tdr.budget_total_valide ?? 0
  const depense = tdr.montant_depense ?? 0
  const solde = budgetTotal - depense
  const pct = budgetTotal > 0 ? Math.round((depense / budgetTotal) * 1000) / 10 : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport de réconciliation — ${esc(tdr.numero ?? '')} — ${esc(tdr.titre_activite)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #111827; padding: 0; margin: 0; line-height: 1.55; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 14px; margin-bottom: 20px; }
  .header img { height: 64px; }
  .org-text { text-align: center; flex: 1; }
  .org-name { font-size: 11pt; font-weight: bold; }
  .org-sub { font-size: 8pt; color: #555; margin-top: 4px; }
  h1.titre-doc { text-align: center; font-size: 15pt; letter-spacing: 2px; margin: 0 0 18px; }
  .meta { background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 10.5pt; }
  .meta div { margin-bottom: 4px; }
  h2.section-titre { font-size: 12.5pt; color: #14532d; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 26px 0 10px; break-after: avoid; page-break-after: avoid; }
  p { margin: 0 0 10px; text-align: justify; white-space: pre-wrap; }
  .resume { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 6px; }
  .resume-item { background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
  .resume-label { font-size: 8.5pt; color: #6b7280; }
  .resume-value { font-size: 12pt; font-weight: bold; margin-top: 2px; }
  .resume-value.negatif { color: #dc2626; }
  table.factures { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; break-inside: avoid; page-break-inside: avoid; }
  table.factures th, table.factures td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.factures th { background: #f0fdf4; font-weight: bold; }
  table.factures td.montant { text-align: right; }
  table.factures tfoot td { font-weight: bold; background: #f9fafb; }
  .muted { color: #9ca3af; font-style: italic; }
  .sig-block { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 50px; page-break-inside: avoid; }
  .sig { text-align: center; }
  .sig-role { font-size: 9pt; font-weight: bold; margin-bottom: 30px; min-height: 26px; }
  .sig-rule { border-top: 1px solid #000; }
  .sig-realname { font-size: 9.5pt; font-weight: bold; margin-top: 10px; color: #111; }
  .sig-stamp { font-size: 8pt; color: #16a34a; margin-top: 3px; font-weight: bold; }
  .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable (ABED-ONG)</div>
      <div class="org-sub">Parakou, Wanssirou, derrière le lycée MB &nbsp;·&nbsp; Tél. : +229 0167779141<br>Email : contact@abedong.org &nbsp;|&nbsp; abedong.org</div>
    </div>
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
  </div>

  <h1 class="titre-doc">RAPPORT DE RÉCONCILIATION FINANCIÈRE</h1>

  <div class="meta">
    <div><strong>TdR N°</strong> ${esc(tdr.numero ?? '—')}</div>
    <div><strong>Activité :</strong> ${esc(tdr.titre_activite)}</div>
    ${tdr.projet ? `<div><strong>Projet :</strong> ${esc(tdr.projet)}</div>` : ''}
    ${tdr.code_budgetaire ? `<div><strong>Code budgétaire :</strong> ${esc(tdr.code_budgetaire)}</div>` : ''}
    <div><strong>Responsable :</strong> ${nomComplet(tdr.initiateur)}${tdr.initiateur?.fonction ? `, ${esc(tdr.initiateur.fonction)}` : ''}</div>
    <div><strong>Période d'exécution prévue :</strong> ${fmtDate(tdr.date_debut_prevue)} au ${fmtDate(tdr.date_fin_prevue)}</div>
    <div><strong>Clôturé le :</strong> ${fmtDate(tdr.cloture_le)}</div>
  </div>

  <h2 class="section-titre">Synthèse financière</h2>
  <div class="resume">
    <div class="resume-item"><div class="resume-label">Budget approuvé</div><div class="resume-value">${fmtMontant(budgetTotal)}</div></div>
    <div class="resume-item"><div class="resume-label">Montant dépensé</div><div class="resume-value">${fmtMontant(depense)}</div></div>
    <div class="resume-item"><div class="resume-label">Solde</div><div class="resume-value${solde < 0 ? ' negatif' : ''}">${fmtMontant(solde)}</div></div>
    <div class="resume-item"><div class="resume-label">% exécution</div><div class="resume-value">${pct}%</div></div>
  </div>
  <p><strong>Exécution finale :</strong> ${tdr.execution_statut ? esc(EXECUTION_STATUT_LABELS[tdr.execution_statut]) : '—'}</p>

  <h2 class="section-titre">Factures justificatives</h2>
  ${factures.length === 0 ? '<p class="muted">Aucune facture enregistrée.</p>' : `
    <table class="factures">
      <thead><tr><th>Description</th><th>Date</th><th>Enregistrée par</th><th>Montant</th></tr></thead>
      <tbody>
        ${factures.map(f => `<tr><td>${esc(f.description)}</td><td>${fmtDate(f.date_facture)}</td><td>${nomComplet(f.enregistre_par)}</td><td class="montant">${fmtMontant(f.montant)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="montant">${fmtMontant(factures.reduce((s, f) => s + f.montant, 0))}</td></tr></tfoot>
    </table>
  `}

  <h2 class="section-titre">Rapport de l'AAF</h2>
  <p>${esc(tdr.rapport_reconciliation_texte) || '<span class="muted">—</span>'}</p>

  <h2 class="section-titre">Signatures</h2>
  <div class="sig-block">
    ${sigBlock('AAF — rapport préparé par', nomComplet(tdr.reconciliation_soumis_par_profile), fmtDate(tdr.reconciliation_soumis_le))}
    ${sigBlock('CAF', nomComplet(tdr.reconciliation_caf_signe_par_profile), fmtDate(tdr.reconciliation_caf_signe_le))}
    ${sigBlock('Responsable', nomComplet(tdr.initiateur), fmtDate(tdr.reconciliation_responsable_signe_le))}
  </div>

  <div class="footer">ABED ONG · Parakou, Bénin · Système de gestion des TdR</div>
</body>
</html>`
}

export async function genererReconciliationPdf(tdr: TdrReconciliation, factures: Facture[]): Promise<Buffer> {
  const html = construireReconciliationHtml(tdr, factures)
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2.54cm', bottom: '2.54cm', left: '2.54cm', right: '2.54cm' },
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

export function nomFichierReconciliationPdf(tdr: { numero: string | null; id: string }): string {
  return `Reconciliation-${(tdr.numero ?? tdr.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}

// Requête standard pour charger un TDR avec tout ce dont le PDF de
// réconciliation a besoin.
export const RECONCILIATION_PDF_SELECT = `id, numero, titre_activite, projet, code_budgetaire,
  date_debut_prevue, date_fin_prevue, budget_total_valide, montant_depense, execution_statut,
  rapport_reconciliation_texte, reconciliation_soumis_le, reconciliation_caf_signe_le,
  reconciliation_responsable_signe_le, cloture_le,
  initiateur:profiles!tdrs_initiateur_id_fkey(nom, prenoms, fonction),
  reconciliation_soumis_par_profile:profiles!tdrs_reconciliation_soumis_par_fkey(nom, prenoms),
  reconciliation_caf_signe_par_profile:profiles!tdrs_reconciliation_caf_signe_par_fkey(nom, prenoms)
`
