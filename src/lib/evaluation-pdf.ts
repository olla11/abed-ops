// Génération du rapport final PDF d'une évaluation de fin de contrat — même
// moteur (Chromium headless) et même identité visuelle que les contrats
// (src/lib/contrat-pdf.ts), pour un rendu cohérent dans toute l'application.

import { PDF_BASE_STYLE, letterheadHtml } from '@/lib/contrat-pdf'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

const GRILLE: { cat: string; items: { key: string; label: string }[] }[] = [
  {
    cat: 'I. Connaissances techniques et professionnelles',
    items: [
      { key: 'c1_1', label: 'Maîtrise des connaissances nécessaires à l\'exercice de ses fonctions' },
      { key: 'c1_2', label: 'Capacité à mettre en pratique les connaissances liées à son poste' },
      { key: 'c1_3', label: 'Aptitude à transférer les compétences techniques' },
      { key: 'c1_4', label: 'Intérêt pour le développement et la mise à jour des connaissances' },
    ],
  },
  {
    cat: 'II. Capacités personnelles',
    items: [
      { key: 'c2_1', label: 'Sens des responsabilités et prise d\'initiative' },
      { key: 'c2_2', label: 'Capacité à prendre des décisions appropriées' },
      { key: 'c2_3', label: 'Aptitude à gérer le stress et les situations difficiles' },
      { key: 'c2_4', label: 'Créativité et innovation dans la résolution des problèmes' },
    ],
  },
  {
    cat: 'III. Qualités relationnelles et comportementales',
    items: [
      { key: 'c3_1', label: 'Qualité des relations interpersonnelles et travail en équipe' },
      { key: 'c3_2', label: 'Communication orale et écrite (clarté, pertinence)' },
      { key: 'c3_3', label: 'Respect des collègues, partenaires et bénéficiaires' },
      { key: 'c3_4', label: 'Adhésion aux valeurs et culture organisationnelle de l\'ABED' },
    ],
  },
  {
    cat: 'IV. Productivité et résultats',
    items: [
      { key: 'c4_1', label: 'Atteinte des objectifs fixés dans les délais impartis' },
      { key: 'c4_2', label: 'Qualité du travail fourni (précision, rigueur)' },
      { key: 'c4_3', label: 'Efficience dans l\'utilisation des ressources disponibles' },
      { key: 'c4_4', label: 'Aptitude à planifier, organiser et prioriser les tâches' },
    ],
  },
  {
    cat: 'V. Comportement et discipline',
    items: [
      { key: 'c5_1', label: 'Assiduité et ponctualité' },
      { key: 'c5_2', label: 'Respect du règlement intérieur et des procédures' },
      { key: 'c5_3', label: 'Engagement et motivation dans le travail' },
      { key: 'c5_4', label: 'Intégrité et éthique professionnelle' },
    ],
  },
]

const SCORE_LABELS: Record<number, string> = {
  1: 'Ne répond pas du tout',
  2: 'Répond partiellement',
  3: 'Répond globalement',
  4: 'Répond complètement',
  5: 'Dépasse largement',
}

export interface EvaluationPdfData {
  employeCivilite: string | null
  employePrenoms: string
  employeNom: string
  poste: string | null
  direction: string | null
  contratTypeContrat: string | null
  contratDateDebut: string | null
  contratDateFin: string | null
  supHier: string | null
  supFonc: string | null
  nomResponsable: string
  nomEvaluateur: string
  descriptionTaches: string | null
  grilleNotes: Record<string, number>
  scoreMoyen: number | null
  qualites: string | null
  pointsAmelioration: string | null
  actionsExceptionnelles: string | null
  evaluationGenerale: string | null
  commentaireEvaluateur: string | null
  sigEvaluateur: string | null
  dateEvaluateur: string | null
  commentaireEvalue: string | null
  sigEvalue: string | null
  dateEvalue: string | null
  avisResponsable: string | null
  commentaireResponsable: string | null
  sigResponsable: string | null
  dateResponsable: string | null
  decisionEvaluateur: string | null
  decisionCaf: string | null
  decisionDe: string | null
  dateEtablissement: string
}

function champ(label: string, valeur: string | null | undefined): string {
  return `<div class="ev-champ"><span class="ev-champ-label">${label}</span><span class="ev-champ-valeur">${valeur || '—'}</span></div>`
}

function blocTexte(titre: string, texte: string | null | undefined): string {
  return `
  <div class="ev-bloc">
    <div class="ev-bloc-titre">${titre}</div>
    <div class="ev-bloc-texte">${texte ? texte.replace(/\n/g, '<br/>') : '<span class="ev-vide">Non renseigné</span>'}</div>
  </div>`
}

function blocSignature(nom: string | null | undefined, date: string | null | undefined): string {
  if (!nom) return '<p class="ev-vide" style="margin-top:8px;">Non signé</p>'
  const d = date ? new Date(date).toLocaleDateString('fr-FR') : ''
  return `<p style="margin-top:10px;font-size:10.5pt;"><strong>${nom}</strong>${d ? `, ${d}` : ''}</p>`
}

function blocDecision(titre: string, decision: string | null | undefined): string {
  return `
  <div class="ev-decision">
    <div class="ev-decision-titre">${titre}</div>
    <div class="ev-decision-valeur ${decision ? 'ev-decision-rendue' : 'ev-decision-attente'}">${decision || 'Décision non rendue'}</div>
  </div>`
}

export function construireEvaluationHtml(d: EvaluationPdfData): string {
  const nomComplet = `${d.employeCivilite ?? ''} ${d.employePrenoms} ${d.employeNom}`.trim()

  const grilleHtml = GRILLE.map(cat => `
    <table class="ev-grille">
      <tr><td colspan="2" class="ev-grille-cat">${cat.cat}</td></tr>
      ${cat.items.map(item => {
        const note = d.grilleNotes[item.key]
        return `
        <tr>
          <td class="ev-grille-item">${item.label}</td>
          <td class="ev-grille-note">${note ? `<strong>${note}/5</strong> — ${SCORE_LABELS[note] ?? ''}` : '<span class="ev-vide">—</span>'}</td>
        </tr>`
      }).join('')}
    </table>`).join('')

  const corpsHtml = `
  <div class="doc-title">
    <h1>Fiche d'évaluation — Fin de contrat</h1>
  </div>
  <div class="doc-ref">
    Rapport final · Parakou, le ${d.dateEtablissement}
  </div>

  <div class="section">
    <h2>Section I — Identification de l'évalué(e)</h2>
    <div class="ev-champs-grid">
      ${champ('Nom & Prénoms', nomComplet)}
      ${champ('Poste occupé', d.poste)}
      ${champ('Direction / Service', d.direction)}
      ${champ('Type de contrat', d.contratTypeContrat)}
      ${champ('Date début', d.contratDateDebut)}
      ${champ('Date fin', d.contratDateFin)}
      ${champ('Supérieur hiérarchique', d.supHier)}
      ${champ('Supérieur fonctionnel', d.supFonc)}
      ${champ('Responsable de département', d.nomResponsable)}
      ${champ('Évaluateur', d.nomEvaluateur)}
    </div>
    ${blocTexte('Description des tâches principales', d.descriptionTaches)}
  </div>

  <div class="section">
    <h2>Section II — Grille d'évaluation des compétences</h2>
    ${grilleHtml}
    ${d.scoreMoyen != null ? `
    <div class="ev-score-moyen">
      Score moyen : <strong>${Number(d.scoreMoyen).toFixed(1)}/5</strong>
    </div>` : ''}
  </div>

  <div class="section">
    <h2>Section III — Appréciation des performances</h2>
    ${blocTexte('Principales qualités et points forts', d.qualites)}
    ${blocTexte('Points à améliorer / axes de développement', d.pointsAmelioration)}
  </div>

  <div class="section">
    <h2>Section IV — Actions / réalisations exceptionnelles</h2>
    ${blocTexte('', d.actionsExceptionnelles)}
  </div>

  <div class="section">
    <h2>Section V — Évaluation générale</h2>
    <p style="font-size:11.5pt;font-weight:bold;color:var(--abed-green,#166534);">${d.evaluationGenerale || 'Non renseignée'}</p>
  </div>

  <div class="section">
    <h2>Section VI — Commentaires et signature de l'évaluateur</h2>
    ${blocTexte('', d.commentaireEvaluateur)}
    ${blocSignature(d.sigEvaluateur, d.dateEvaluateur)}
  </div>

  <div class="section">
    <h2>Section VII — Commentaires de l'évalué(e)</h2>
    ${blocTexte('', d.commentaireEvalue)}
    ${blocSignature(d.sigEvalue, d.dateEvalue)}
  </div>

  <div class="section">
    <h2>Section VIII — Avis du responsable de département</h2>
    <p style="font-size:11pt;font-weight:bold;margin-bottom:8px;">${d.avisResponsable || 'Non renseigné'}</p>
    ${blocTexte('', d.commentaireResponsable)}
    ${blocSignature(d.sigResponsable, d.dateResponsable)}
  </div>

  <div class="section">
    <h2>Section X — Décisions finales</h2>
    <div class="ev-decisions">
      ${blocDecision('Évaluateur', d.decisionEvaluateur)}
      ${blocDecision('CAF', d.decisionCaf)}
      ${blocDecision('Direction Exécutive', d.decisionDe)}
    </div>
  </div>
  `

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche d'évaluation — ${d.employePrenoms} ${d.employeNom}</title>
  <style>${PDF_BASE_STYLE}
    .ev-champs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 14px; }
    .ev-champ { display: flex; gap: 8px; font-size: 10.5pt; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
    .ev-champ-label { font-weight: bold; min-width: 170px; color: #444; }
    .ev-champ-valeur { flex: 1; }
    .ev-bloc { margin-top: 10px; }
    .ev-bloc-titre { font-size: 10.5pt; font-weight: bold; margin-bottom: 4px; color: #333; }
    .ev-bloc-texte { font-size: 10.5pt; line-height: 1.7; text-align: justify; }
    .ev-vide { color: #aaa; font-style: italic; }
    .ev-grille { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .ev-grille-cat { font-size: 10pt; font-weight: bold; color: #1f7a1f; padding: 8px 4px 4px; border-bottom: 1px solid #ccc; }
    .ev-grille-item { font-size: 10pt; padding: 4px; width: 65%; border-bottom: 1px solid #f3f3f3; }
    .ev-grille-note { font-size: 10pt; padding: 4px; text-align: right; border-bottom: 1px solid #f3f3f3; white-space: nowrap; }
    .ev-score-moyen { text-align: center; background: #f0fdf4; border-radius: 8px; padding: 10px; font-size: 13pt; color: #166534; margin-top: 8px; }
    .ev-decisions { display: flex; flex-direction: column; gap: 10px; }
    .ev-decision { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .ev-decision-titre { font-weight: bold; font-size: 10.5pt; min-width: 160px; }
    .ev-decision-valeur { font-size: 10.5pt; padding: 3px 10px; border-radius: 20px; }
    .ev-decision-rendue { background: #f0fdf4; color: #166534; font-weight: bold; }
    .ev-decision-attente { background: #f3f4f6; color: #9ca3af; font-style: italic; }
  </style>
</head>
<body>
  ${letterheadHtml()}

  <div class="page-content">
    ${corpsHtml}

    <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion RH — Rapport généré automatiquement</div>
  </div>
</body>
</html>`
}

export async function genererEvaluationPdf(d: EvaluationPdfData): Promise<Buffer> {
  const html = construireEvaluationHtml(d)
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

export function nomFichierEvaluationPdf(employePrenoms: string, employeNom: string, id: string): string {
  const base = `${employePrenoms}_${employeNom}`.trim() || id
  return `Evaluation-${base.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}
