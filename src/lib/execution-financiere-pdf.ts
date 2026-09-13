// Rapport PDF détaillé d'exécution financière — même rendu Chromium headless
// que les autres documents officiels ABED-ONG (contrat-pdf.ts,
// appel-de-fonds-pdf.ts), réutilise le même en-tête. Le "graphique" est un
// simple diagramme en barres construit en CSS (divs proportionnés), rendu
// par Chromium comme n'importe quel autre HTML — pas besoin de lib de
// graphiques côté serveur.
import { PDF_BASE_STYLE, letterheadHtml } from '@/lib/contrat-pdf'
import type { LigneExecutionFinanciere } from '@/lib/execution-financiere'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export type CommentaireExecutionFinanciere = { trimestre: number; commentaire: string }

export interface ExecutionFinancierePdfData {
  annee: number
  lignes: LigneExecutionFinanciere[]
  totaux: { budgetAnnuel: number; totalDepense: number; disponible: number }
  commentaires: CommentaireExecutionFinanciere[]
}

const EF_STYLE = `
  .ef-kpis { display: flex; gap: 10px; margin-bottom: 18px; }
  .ef-kpi { flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 10px 12px; }
  .ef-kpi-label { font-size: 8pt; color: #666; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
  .ef-kpi-value { font-size: 13pt; font-weight: 800; }
  .ef-section-title { font-size: 12pt; font-weight: 800; color: #2d7a31; margin: 20px 0 10px; border-bottom: 2px solid #2d7a31; padding-bottom: 4px; }
  table.ef-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 8pt; }
  table.ef-table th, table.ef-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.ef-table th { background: #f4b93e; font-weight: 700; text-align: center; }
  table.ef-table td.num { text-align: right; white-space: nowrap; }
  table.ef-table tr.rubrique td { font-weight: 800; background: #eef7ee; color: #2d7a31; }
  .ef-chart { display: flex; align-items: flex-end; gap: 22px; height: 160px; padding: 10px 10px 0; border-bottom: 1.5px solid #333; margin-bottom: 6px; }
  .ef-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .ef-chart-bars { display: flex; align-items: flex-end; gap: 4px; height: 100%; width: 100%; justify-content: center; }
  .ef-bar { width: 22px; border-radius: 2px 2px 0 0; position: relative; }
  .ef-bar-budget { background: #cbd5e1; }
  .ef-bar-depense { background: #2d7a31; }
  .ef-bar-value { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 6.5pt; white-space: nowrap; }
  .ef-chart-label { margin-top: 6px; font-size: 8pt; font-weight: 700; }
  .ef-legend { display: flex; gap: 18px; font-size: 8pt; margin-bottom: 16px; }
  .ef-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .ef-legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .ef-commentaire { border-left: 3px solid #2d7a31; padding: 6px 12px; margin-bottom: 8px; font-size: 9pt; background: #fafafa; }
  .ef-commentaire b { color: #2d7a31; }
`

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

function construireGraphique(lignesDetail: LigneExecutionFinanciere[]): string {
  const totBudgetT = [0, 0, 0, 0]
  const totDepT = [0, 0, 0, 0]
  for (const l of lignesDetail) {
    totBudgetT[0] += l.budgetT1; totBudgetT[1] += l.budgetT2; totBudgetT[2] += l.budgetT3; totBudgetT[3] += l.budgetT4
    totDepT[0] += l.depenseT1; totDepT[1] += l.depenseT2; totDepT[2] += l.depenseT3; totDepT[3] += l.depenseT4
  }
  const max = Math.max(1, ...totBudgetT, ...totDepT)
  const cols = [0, 1, 2, 3].map(i => {
    const hBudget = Math.max(2, (totBudgetT[i] / max) * 130)
    const hDep = Math.max(2, (totDepT[i] / max) * 130)
    return `
      <div class="ef-chart-col">
        <div class="ef-chart-bars">
          <div class="ef-bar ef-bar-budget" style="height:${hBudget}px;"><span class="ef-bar-value">${fmt(totBudgetT[i])}</span></div>
          <div class="ef-bar ef-bar-depense" style="height:${hDep}px;"><span class="ef-bar-value">${fmt(totDepT[i])}</span></div>
        </div>
        <div class="ef-chart-label">T${i + 1}</div>
      </div>`
  }).join('')
  return `<div class="ef-chart">${cols}</div>
    <div class="ef-legend">
      <span><i style="background:#cbd5e1;"></i> Budgété</span>
      <span><i style="background:#2d7a31;"></i> Dépensé</span>
    </div>`
}

export function construireExecutionFinanciereHtml(d: ExecutionFinancierePdfData): string {
  const lignesDetail = d.lignes.filter(l => !l.estRubrique)
  const pctGlobal = d.totaux.budgetAnnuel > 0 ? (d.totaux.totalDepense / d.totaux.budgetAnnuel) * 100 : 0

  const lignesHtml = d.lignes.map(l => `
    <tr${l.estRubrique ? ' class="rubrique"' : ''}>
      <td>${l.code}</td>
      <td>${l.libelle}</td>
      <td class="num">${l.budgetAnnuel ? fmt(l.budgetAnnuel) : '—'}</td>
      <td class="num">${l.depenseT1 ? fmt(l.depenseT1) : '—'}</td>
      <td class="num">${l.depenseT2 ? fmt(l.depenseT2) : '—'}</td>
      <td class="num">${l.depenseT3 ? fmt(l.depenseT3) : '—'}</td>
      <td class="num">${l.depenseT4 ? fmt(l.depenseT4) : '—'}</td>
      <td class="num"><strong>${fmt(l.totalDepense)}</strong></td>
      <td class="num">${fmt(l.disponible)}</td>
      <td class="num">${l.budgetAnnuel > 0 ? l.pctExecution.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('')

  const trimLabels = ['1er trimestre', '2e trimestre', '3e trimestre', '4e trimestre']
  const commentairesHtml = [1, 2, 3, 4].map(t => {
    const c = d.commentaires.find(x => x.trimestre === t)
    if (!c?.commentaire) return ''
    return `<div class="ef-commentaire"><b>${trimLabels[t - 1]} :</b> ${c.commentaire}</div>`
  }).join('')
  const commentaireAnnuel = d.commentaires.find(x => x.trimestre === 0)?.commentaire

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport d'exécution financière ${d.annee} — ABED-ONG</title>
  <style>${PDF_BASE_STYLE}${EF_STYLE}</style>
</head>
<body>
  ${letterheadHtml()}
  <div class="page-content">
    <div style="text-align:center;font-weight:700;font-size:13pt;margin:6px 0 4px;text-transform:uppercase;">
      Rapport d'exécution financière — ${d.annee}
    </div>
    <div style="text-align:center;font-size:9pt;color:#666;margin-bottom:18px;">
      Document généré le ${new Date().toLocaleDateString('fr-FR')}
    </div>

    <div class="ef-kpis">
      <div class="ef-kpi"><div class="ef-kpi-label">Budget adopté</div><div class="ef-kpi-value">${fmt(d.totaux.budgetAnnuel)} FCFA</div></div>
      <div class="ef-kpi"><div class="ef-kpi-label">Dépensé (payé)</div><div class="ef-kpi-value">${fmt(d.totaux.totalDepense)} FCFA</div></div>
      <div class="ef-kpi"><div class="ef-kpi-label">Disponible</div><div class="ef-kpi-value">${fmt(d.totaux.disponible)} FCFA</div></div>
      <div class="ef-kpi"><div class="ef-kpi-label">Exécution globale</div><div class="ef-kpi-value">${pctGlobal.toFixed(1)}%</div></div>
    </div>

    <div class="ef-section-title">Budget vs dépenses par trimestre</div>
    ${construireGraphique(lignesDetail)}

    <div class="ef-section-title">Détail par ligne budgétaire</div>
    <table class="ef-table">
      <thead>
        <tr>
          <th>Code</th><th>Ligne budgétaire</th><th>Budget adopté</th>
          <th>Dépensé T1</th><th>Dépensé T2</th><th>Dépensé T3</th><th>Dépensé T4</th>
          <th>Total dépensé</th><th>Disponible</th><th>% Exéc.</th>
        </tr>
      </thead>
      <tbody>${lignesHtml}</tbody>
    </table>

    ${(commentairesHtml || commentaireAnnuel) ? `
      <div class="ef-section-title">Commentaires de la CAF</div>
      ${commentairesHtml}
      ${commentaireAnnuel ? `<div class="ef-commentaire"><b>Commentaire annuel :</b> ${commentaireAnnuel}</div>` : ''}
    ` : ''}

    <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion financière</div>
  </div>
</body>
</html>`
}

export async function genererExecutionFinancierePdf(d: ExecutionFinancierePdfData): Promise<Buffer> {
  const html = construireExecutionFinanciereHtml(d)
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
