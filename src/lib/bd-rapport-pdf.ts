// Génération du rapport périodique (mensuel/trimestriel) du pipeline BD —
// même principe que tdr-reconciliation-pdf.ts (HTML -> PDF via Puppeteer),
// avec un mini graphique en barres CSS pour la répartition par statut
// (pas de librairie de graphes côté serveur, ce rendu HTML statique suffit).

import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'
import { STATUT_LABELS, STATUT_COLORS, TYPE_OPPORTUNITE_LABELS, type OpportuniteStatut, type TypeOpportunite } from '@/lib/bd'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

type ProfileNom = { nom: string; prenoms: string } | null

export type RapportOpportunite = {
  id: string
  titre: string
  bailleur: string | null
  type_opportunite: TypeOpportunite
  statut: OpportuniteStatut
  date_identification: string
  date_soumission: string | null
  date_limite: string | null
  montant_demande: number | null
  montant_obtenu: number | null
  identifie_par: ProfileNom
  responsable: ProfileNom
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

function fmtMontant(n: number | null | undefined): string {
  return n ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—'
}

function nomComplet(p: ProfileNom): string {
  return p ? `${p.prenoms} ${p.nom}` : '—'
}

function kpiTile(label: string, value: string, sub?: string): string {
  return `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value">${esc(value)}</div>
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
    </div>
  `
}

function barreStatuts(opportunites: RapportOpportunite[]): string {
  const total = opportunites.length
  if (total === 0) return '<p class="muted">Aucune opportunité soumise durant la période.</p>'
  const repartition = (Object.keys(STATUT_LABELS) as OpportuniteStatut[])
    .map(s => ({ statut: s, value: opportunites.filter(o => o.statut === s).length }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = Math.max(...repartition.map(r => r.value))
  return `
    <div class="bars">
      ${repartition.map(r => {
        const pct = Math.round((r.value / max) * 100)
        const part = Math.round((r.value / total) * 100)
        return `
          <div class="bar-row">
            <div class="bar-head">
              <span>${esc(STATUT_LABELS[r.statut])}</span>
              <span><strong>${r.value}</strong> <span class="muted-inline">(${part}%)</span></span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${STATUT_COLORS[r.statut]}"></div></div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function tableauOpportunites(
  opportunites: RapportOpportunite[],
  colonnes: { dateLabel: string; date: (o: RapportOpportunite) => string; montant?: boolean },
): string {
  if (opportunites.length === 0) return '<p class="muted">Aucune opportunité.</p>'
  return `
    <table class="opps">
      <thead>
        <tr>
          <th>Intitulé</th><th>Bailleur</th><th>Type</th><th>${esc(colonnes.dateLabel)}</th>
          <th>Responsable</th><th>Statut</th>${colonnes.montant ? '<th>Montant demandé</th><th>Montant obtenu</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${opportunites.map(o => `
          <tr>
            <td>${esc(o.titre)}</td>
            <td>${esc(o.bailleur) || '—'}</td>
            <td>${esc(TYPE_OPPORTUNITE_LABELS[o.type_opportunite])}</td>
            <td>${colonnes.date(o)}</td>
            <td>${nomComplet(o.responsable)}</td>
            <td><span class="badge" style="color:${STATUT_COLORS[o.statut]};background:${STATUT_COLORS[o.statut]}18;border-color:${STATUT_COLORS[o.statut]}55">${esc(STATUT_LABELS[o.statut])}</span></td>
            ${colonnes.montant ? `<td class="montant">${fmtMontant(o.montant_demande)}</td><td class="montant">${fmtMontant(o.montant_obtenu)}</td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

export function construireRapportBDHtml(params: {
  periodeLabel: string
  periodeType: 'Mensuel' | 'Trimestriel'
  identifiees: RapportOpportunite[]
  soumises: RapportOpportunite[]
}): string {
  const { periodeLabel, periodeType, identifiees, soumises } = params

  const nbIdentifiees = identifiees.length
  const nbSoumises = soumises.length
  const nbAcceptees = soumises.filter(o => o.statut === 'accepte').length
  const nbRefusees = soumises.filter(o => o.statut === 'refuse').length
  const nbSansReponse = soumises.filter(o => o.statut === 'sans_reponse').length
  const nbEnAttente = soumises.filter(o => o.statut === 'soumis').length
  const resolues = nbAcceptees + nbRefusees
  const tauxSucces = resolues > 0 ? Math.round((nbAcceptees / resolues) * 100) : null

  const montantDemande = soumises.reduce((s, o) => s + (Number(o.montant_demande) || 0), 0)
  const montantObtenu = soumises.reduce((s, o) => s + (Number(o.montant_obtenu) || 0), 0)
  const tauxConversion = montantDemande > 0 ? Math.round((montantObtenu / montantDemande) * 100) : null

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport BD — ${esc(periodeLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 10.5pt; color: #111827; padding: 0; margin: 0; line-height: 1.5; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 14px; margin-bottom: 20px; }
  .header img { height: 60px; }
  .org-text { text-align: center; flex: 1; }
  .org-name { font-size: 10.5pt; font-weight: bold; }
  .org-sub { font-size: 8pt; color: #555; margin-top: 4px; }
  h1.titre-doc { text-align: center; font-size: 15pt; letter-spacing: 1.5px; margin: 0 0 4px; color: #14532d; }
  p.sous-titre { text-align: center; font-size: 11pt; color: #4b5563; margin: 0 0 20px; }
  h2.section-titre { font-size: 12pt; color: #14532d; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 26px 0 12px; break-after: avoid; page-break-after: avoid; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 6px; }
  .kpis.small { grid-template-columns: repeat(2, 1fr); }
  .kpi { background: #f9fafb; border-radius: 8px; padding: 10px 12px; border: 1px solid #eef0f2; }
  .kpi-label { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; }
  .kpi-value { font-size: 15pt; font-weight: bold; margin-top: 3px; }
  .kpi-sub { font-size: 8pt; color: #9ca3af; margin-top: 2px; }
  .bars { display: flex; flex-direction: column; gap: 12px; margin-bottom: 6px; }
  .bar-head { display: flex; justify-content: space-between; font-size: 9.5pt; margin-bottom: 4px; }
  .muted-inline { color: #9ca3af; }
  .bar-track { height: 9px; border-radius: 5px; background: #f3f4f6; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; }
  table.opps { width: 100%; border-collapse: collapse; margin: 4px 0 16px; font-size: 8.5pt; }
  table.opps th, table.opps td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.opps th { background: #f0fdf4; font-weight: bold; font-size: 8pt; }
  table.opps td.montant { text-align: right; white-space: nowrap; }
  .badge { display: inline-block; font-size: 7.5pt; font-weight: bold; border: 1px solid; border-radius: 10px; padding: 1px 7px; white-space: nowrap; }
  .muted { color: #9ca3af; font-style: italic; }
  .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable (ABED-ONG)</div>
      <div class="org-sub">Parakou, Quartier Zongo, Troisième vons après le CS/Zongo &nbsp;·&nbsp; Tél. : +229 0167779141<br>Email : contact@abedong.org &nbsp;|&nbsp; abedong.org</div>
    </div>
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
  </div>

  <h1 class="titre-doc">RAPPORT ${periodeType.toUpperCase()} — BUSINESS DEVELOPMENT</h1>
  <p class="sous-titre">Pipeline des opportunités de financement — ${esc(periodeLabel)}</p>

  <h2 class="section-titre">Résumé exécutif</h2>
  <div class="kpis">
    ${kpiTile('Identifiées', String(nbIdentifiees), 'durant la période')}
    ${kpiTile('Soumises', String(nbSoumises), 'durant la période')}
    ${kpiTile('Taux de succès', tauxSucces !== null ? `${tauxSucces}%` : '—', resolues > 0 ? `${nbAcceptees} sur ${resolues} réponses reçues` : 'aucune réponse reçue')}
    ${kpiTile('En attente de réponse', String(nbEnAttente), 'parmi les soumissions')}
  </div>
  <div class="kpis small">
    ${kpiTile('Montant total demandé', fmtMontant(montantDemande), 'opportunités soumises')}
    ${kpiTile('Montant total obtenu', fmtMontant(montantObtenu), tauxConversion !== null ? `${tauxConversion}% du montant demandé` : undefined)}
  </div>

  <h2 class="section-titre">Répartition des soumissions par statut</h2>
  ${barreStatuts(soumises)}

  <h2 class="section-titre">Opportunités identifiées durant la période (${nbIdentifiees})</h2>
  ${tableauOpportunites(identifiees, { dateLabel: 'Identifiée le', date: o => fmtDate(o.date_identification) })}

  <h2 class="section-titre">Opportunités soumises durant la période (${nbSoumises})</h2>
  ${tableauOpportunites(soumises, { dateLabel: 'Soumise le', date: o => fmtDate(o.date_soumission), montant: true })}

  <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Rapport généré le ${fmtDate(new Date().toISOString())} · Système de gestion des opportunités BD</div>
</body>
</html>`
}

export async function genererRapportBDPdf(params: Parameters<typeof construireRapportBDHtml>[0]): Promise<Buffer> {
  const html = construireRapportBDHtml(params)
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1.8cm', bottom: '1.8cm', left: '1.8cm', right: '1.8cm' },
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

export function nomFichierRapportBDPdf(periodeSlug: string): string {
  return `Rapport-BD-${periodeSlug.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}
