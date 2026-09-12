// Génération de la « Fiche Personnel » — document de synthèse RH (2 pages)
// qui suit une personne de son entrée à sa sortie : identification,
// coordonnées, historique des contrats, évaluations, ancienneté et salaire
// cumulé estimé. Rendu via Chromium headless, même mécanisme que
// src/lib/contrat-pdf.ts (mais design propre, distinct du style "contrat
// légal" — cette fiche est un tableau de bord RH, pas un document signé).

import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface FicheContrat {
  id: string
  numero: string | null
  categorie_document: string | null
  type_contrat: string
  poste: string | null
  date_debut: string
  date_fin: string | null
  statut: string
  salaire_brut: number | null
  heures_max_mois: number | null
  contrat_parent_id: string | null
  renouvele_depuis: string | null
}

export interface FicheEvaluation {
  id: string
  declenchee_le: string | null
  score_moyen: number | null
  statut: string
  evaluateur_nom: string | null
}

export interface FicheCongeSolde {
  type: string
  jours_acquis: number
  jours_pris: number
}

export interface FichePersonnelData {
  civilite: string | null
  nom: string
  prenoms: string
  matricule: string | null
  photoUrl: string | null
  titreLabel: string | null
  fonction: string | null
  direction: string | null
  typeEmploiLabel: string | null
  archived: boolean
  archivedAt: string | null
  archivedReason: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  genre: string | null
  niveauEtude: string | null
  nombreEnfants: number | null
  ifu: string | null
  numeroImmatriculation: string | null
  gradeIndice: string | null
  dateEmbauche: string | null
  biographie: string | null
  citationFavorite: string | null
  lienProfessionnel: string | null
  notesRh: string | null
  contrats: FicheContrat[]
  evaluations: FicheEvaluation[]
  conges: { annee: number; soldes: FicheCongeSolde[] }
  genereLe: string
  genereParNom: string
}

function fmtFCFA(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initiales(nom: string, prenoms: string): string {
  return `${(prenoms[0] ?? '').toUpperCase()}${(nom[0] ?? '').toUpperCase()}`
}

// Nombre de mois entiers entre deux dates (arrondi à l'entier supérieur,
// minimum 1) — sert de base à l'estimation du coût mensuel × durée.
function moisEntre(debutIso: string, finIso: string): number {
  const d1 = new Date(debutIso)
  const d2 = new Date(finIso)
  let mois = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
  if (d2.getDate() >= d1.getDate()) mois += 1
  return Math.max(1, mois)
}

function coutMensuelContrat(c: FicheContrat): number {
  if ((c.type_contrat ?? '').toLowerCase().includes('prestataire')) {
    return (c.salaire_brut ?? 0) * (c.heures_max_mois ?? 0)
  }
  return c.salaire_brut ?? 0
}

// Toutes les catégories (y compris Offre — pour un stage/bénévolat/bourse
// jamais transformé en Convention/Contrat, l'Offre EST le document sous
// lequel la personne a réellement servi, avec ses propres dates et sa propre
// allocation) comptent comme des périodes de service potentielles. Un
// avenant modifie le contrat qu'il rattache (contrat_parent_id) plutôt que de
// créer une période supplémentaire — pour ne pas compter deux fois la même
// période, seul le dernier maillon de chaque chaîne d'avenants (celui qu'aucun
// autre document ne référence comme parent) est retenu, avec la date de début
// du tout premier document de la chaîne (le root, qu'il s'agisse d'une Offre,
// d'un Contrat ou d'une Convention) et le taux du dernier maillon (les termes
// les plus récents). Un renouvellement classique (renouvele_depuis, sans
// contrat_parent_id) crée au contraire une période bien distincte et se
// compte séparément, tel quel.
export function calculerAnciennenteEtSalaire(
  contrats: FicheContrat[],
  dateFinPeriode: string
): { anciennete: { annees: number; mois: number; texte: string } | null; salaireCumule: number; detail: { numero: string | null; type: string; debut: string; fin: string; mois: number; tauxMensuel: number; montant: number }[] } {
  const estFeuille = (c: FicheContrat) => !contrats.some(other => other.contrat_parent_id === c.id)
  const racine = (c: FicheContrat): FicheContrat => {
    let cur = c
    while (cur.contrat_parent_id) {
      const parent = contrats.find(p => p.id === cur.contrat_parent_id)
      if (!parent) break
      cur = parent
    }
    return cur
  }

  const feuilles = contrats.filter(estFeuille)
  let total = 0
  const detail: { numero: string | null; type: string; debut: string; fin: string; mois: number; tauxMensuel: number; montant: number }[] = []
  let plusAncienneDebut: string | null = null

  for (const feuille of feuilles) {
    const root = racine(feuille)
    const debut = root.date_debut
    const fin = feuille.date_fin ?? dateFinPeriode
    const mois = moisEntre(debut, fin)
    const tauxMensuel = coutMensuelContrat(feuille)
    const montant = tauxMensuel * mois
    total += montant
    detail.push({ numero: feuille.numero, type: feuille.type_contrat, debut, fin, mois, tauxMensuel, montant })
    if (!plusAncienneDebut || debut < plusAncienneDebut) plusAncienneDebut = debut
  }

  if (!plusAncienneDebut) return { anciennete: null, salaireCumule: total, detail }

  const d1 = new Date(plusAncienneDebut)
  const d2 = new Date(dateFinPeriode)
  let mois = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
  if (d2.getDate() < d1.getDate()) mois -= 1
  mois = Math.max(0, mois)
  const annees = Math.floor(mois / 12)
  const moisRestants = mois % 12
  const texte = annees > 0
    ? `${annees} an${annees > 1 ? 's' : ''}${moisRestants > 0 ? ` ${moisRestants} mois` : ''}`
    : `${moisRestants} mois`
  return { anciennete: { annees, mois: moisRestants, texte }, salaireCumule: total, detail }
}

const STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #1f2a17; background: #fff; }
  .page2 { page-break-before: always; }

  .header { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg, #4d8019, #63a521); border-radius: 12px; padding: 12px 18px; color: #fff; margin-bottom: 16px; }
  /* Logo forcé en blanc uni (silhouette) pour rester visible sur le fond vert
     du bandeau — le PNG source est en couleur (vert/orange/noir), illisible
     tel quel sur ce fond. */
  .header img { height: 40px; width: auto; flex-shrink: 0; filter: brightness(0) invert(1); }
  .header-org { font-size: 8pt; letter-spacing: .6px; text-transform: uppercase; opacity: .92; font-weight: 700; }
  .header-title { font-size: 14pt; font-weight: 800; letter-spacing: .2px; }
  .header-meta { margin-left: auto; text-align: right; font-size: 7.5pt; opacity: .92; line-height: 1.5; }

  .hero { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 2px solid #e3e8dd; }
  .hero-photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid #63a521; flex-shrink: 0; }
  .hero-photo-placeholder { width: 84px; height: 84px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e3e8dd; color: #4d8019; font-size: 22pt; font-weight: 800; flex-shrink: 0; font-family: Arial, sans-serif; }
  .hero-name { font-size: 15pt; font-weight: 800; color: #1f2a17; }
  .hero-role { font-size: 9.5pt; color: #6b7280; margin-top: 2px; }
  .hero-badges { display: flex; gap: 6px; margin-top: 9px; flex-wrap: wrap; }
  .badge { font-size: 7.3pt; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: .3px; }
  .badge-vert { background: #eef7e3; color: #4d8019; }
  .badge-bleu { background: #eaf0fb; color: #2f5496; }
  .badge-rouge { background: #fbeae8; color: #c0392b; }
  .badge-ambre { background: #fdf3e0; color: #a5670a; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { background: #f4f6f1; border: 1px solid #e3e8dd; border-radius: 10px; padding: 10px 8px; text-align: center; }
  .kpi-val { font-size: 12.5pt; font-weight: 800; color: #4d8019; }
  .kpi-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: .3px; margin-top: 3px; }

  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .panel { background: #fff; border: 1px solid #e3e8dd; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
  .panel-title { font-size: 8.7pt; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #4d8019; border-left: 3px solid #63a521; padding-left: 8px; margin-bottom: 10px; }
  .kv-row { display: flex; justify-content: space-between; gap: 8px; font-size: 8.8pt; padding: 3.5px 0; border-bottom: 1px dashed #eef1ea; }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { color: #6b7280; }
  .kv-value { font-weight: 700; text-align: right; }

  .quote { background: #fdf3e0; border-left: 3px solid #d98e04; border-radius: 6px; padding: 9px 14px; font-style: italic; font-size: 8.8pt; color: #5c4400; margin-bottom: 10px; }
  .bio { font-size: 8.8pt; line-height: 1.6; color: #374151; }

  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  th { background: #f4f6f1; color: #4d8019; text-transform: uppercase; font-size: 6.9pt; letter-spacing: .3px; text-align: left; padding: 6px 7px; border-bottom: 2px solid #e3e8dd; }
  td { padding: 5px 7px; border-bottom: 1px solid #f0f2ec; }
  tr:nth-child(even) td { background: #fafbf8; }
  .num { text-align: right; }
  .empty-row td { text-align: center; color: #9ca3af; font-style: italic; padding: 10px; }

  .footer-note { text-align: center; font-size: 7.3pt; color: #9ca3af; margin-top: 18px; padding-top: 8px; border-top: 1px solid #e3e8dd; }
`

function headerHtml(d: FichePersonnelData): string {
  return `
  <div class="header">
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="ABED">
    <div>
      <div class="header-org">ABED-ONG · Ressources Humaines</div>
      <div class="header-title">Fiche Personnel</div>
    </div>
    <div class="header-meta">
      Généré le ${d.genereLe}<br>
      Par ${d.genereParNom}
    </div>
  </div>`
}

function heroHtml(d: FichePersonnelData): string {
  const photo = d.photoUrl
    ? `<img class="hero-photo" src="${d.photoUrl}" alt="Photo">`
    : `<div class="hero-photo-placeholder">${initiales(d.nom, d.prenoms)}</div>`
  const statutBadge = d.archived
    ? `<span class="badge badge-rouge">Sorti${d.archivedAt ? ` le ${fmtDate(d.archivedAt)}` : ''}</span>`
    : `<span class="badge badge-vert">En poste</span>`
  return `
  <div class="hero">
    ${photo}
    <div>
      <div class="hero-name">${d.civilite ?? ''} ${d.prenoms} ${d.nom}</div>
      <div class="hero-role">${d.titreLabel ?? d.fonction ?? '—'}${d.direction ? ` — ${d.direction}` : ''}</div>
      <div class="hero-badges">
        ${d.matricule ? `<span class="badge badge-bleu">Matricule ${d.matricule}</span>` : ''}
        ${statutBadge}
        ${d.typeEmploiLabel ? `<span class="badge badge-ambre">${d.typeEmploiLabel}</span>` : ''}
      </div>
    </div>
  </div>`
}

function kpisHtml(d: FichePersonnelData, anciennete: { texte: string } | null, salaireCumule: number, scoreMoyen: number | null): string {
  return `
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${anciennete ? anciennete.texte : '—'}</div><div class="kpi-label">Ancienneté</div></div>
    <div class="kpi"><div class="kpi-val">${fmtFCFA(salaireCumule)}</div><div class="kpi-label">Salaire cumulé (est.)</div></div>
    <div class="kpi"><div class="kpi-val">${d.contrats.length}</div><div class="kpi-label">Documents RH</div></div>
    <div class="kpi"><div class="kpi-val">${scoreMoyen != null ? scoreMoyen.toFixed(2) : '—'}${scoreMoyen != null ? '/5' : ''}</div><div class="kpi-label">Score moyen éval.</div></div>
  </div>`
}

function kv(label: string, value: string | null | undefined): string {
  return `<div class="kv-row"><span class="kv-label">${label}</span><span class="kv-value">${value && value.trim() ? value : '—'}</span></div>`
}

function identificationHtml(d: FichePersonnelData): string {
  return `
  <div class="panel">
    <div class="panel-title">Identification</div>
    ${kv('Date de naissance', fmtDate(d.dateNaissance))}
    ${kv('Lieu de naissance', d.lieuNaissance)}
    ${kv('Nationalité', d.nationalite)}
    ${kv('Genre', d.genre === 'M' ? 'Masculin' : d.genre === 'F' ? 'Féminin' : null)}
    ${kv("Nombre d'enfants", d.nombreEnfants != null ? String(d.nombreEnfants) : null)}
    ${kv("Niveau d'étude", d.niveauEtude)}
    ${kv('IFU', d.ifu)}
    ${kv('Immatriculation', d.numeroImmatriculation)}
    ${kv('Grade / Indice', d.gradeIndice)}
  </div>`
}

function coordonneesHtml(d: FichePersonnelData): string {
  return `
  <div class="panel">
    <div class="panel-title">Coordonnées</div>
    ${kv('Téléphone / WhatsApp', d.telephone)}
    ${kv('Email', d.email)}
    ${kv('Adresse', d.adresse)}
    ${kv('Ville', d.ville)}
    ${kv('Profil professionnel', d.lienProfessionnel)}
    ${kv('Date de prise de service', fmtDate(d.dateEmbauche))}
    ${d.archived ? kv('Motif de sortie', d.archivedReason) : ''}
  </div>`
}

function bioHtml(d: FichePersonnelData): string {
  if (!d.biographie && !d.citationFavorite) return ''
  return `
  <div class="panel">
    <div class="panel-title">À propos</div>
    ${d.citationFavorite ? `<div class="quote">« ${d.citationFavorite} »</div>` : ''}
    ${d.biographie ? `<div class="bio">${d.biographie}</div>` : ''}
  </div>`
}

const CATEGORIE_ORDER: Record<string, number> = { Offre: 0, Convention: 1, Contrat: 2, Avenant: 3 }

function contratsTableHtml(d: FichePersonnelData): string {
  const rows = [...d.contrats]
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    .map(c => `
      <tr>
        <td>${c.numero ?? '—'}</td>
        <td>${c.categorie_document ?? 'Contrat'}</td>
        <td>${c.type_contrat}</td>
        <td>${c.poste ?? '—'}</td>
        <td>${fmtDate(c.date_debut)}</td>
        <td>${c.date_fin ? fmtDate(c.date_fin) : 'Indéterminée'}</td>
        <td>${c.statut}</td>
        <td class="num">${c.salaire_brut ? fmtFCFA(c.salaire_brut) : '—'}</td>
      </tr>`).join('')
  return `
  <div class="panel">
    <div class="panel-title">Historique des documents RH (${d.contrats.length})</div>
    <table>
      <thead><tr><th>N°</th><th>Catégorie</th><th>Type</th><th>Poste</th><th>Début</th><th>Fin</th><th>Statut</th><th>Taux/Salaire</th></tr></thead>
      <tbody>${rows || `<tr class="empty-row"><td colspan="8">Aucun document RH enregistré.</td></tr>`}</tbody>
    </table>
  </div>`
}

function evaluationsTableHtml(d: FichePersonnelData): string {
  const rows = [...d.evaluations]
    .sort((a, b) => (b.declenchee_le ?? '').localeCompare(a.declenchee_le ?? ''))
    .map(e => `
      <tr>
        <td>${e.declenchee_le ? fmtDate(e.declenchee_le) : '—'}</td>
        <td>${e.evaluateur_nom ?? '—'}</td>
        <td>${e.statut}</td>
        <td class="num">${e.score_moyen != null ? `${Number(e.score_moyen).toFixed(2)}/5` : '—'}</td>
      </tr>`).join('')
  return `
  <div class="panel">
    <div class="panel-title">Évaluations (${d.evaluations.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Évaluateur</th><th>Statut</th><th>Score</th></tr></thead>
      <tbody>${rows || `<tr class="empty-row"><td colspan="4">Aucune évaluation enregistrée.</td></tr>`}</tbody>
    </table>
  </div>`
}

function congesHtml(d: FichePersonnelData): string {
  const rows = d.conges.soldes.map(s => `
    <tr>
      <td>${s.type}</td>
      <td class="num">${s.jours_acquis}</td>
      <td class="num">${s.jours_pris}</td>
      <td class="num"><strong>${(s.jours_acquis - s.jours_pris).toFixed(1)}</strong></td>
    </tr>`).join('')
  return `
  <div class="panel">
    <div class="panel-title">Soldes de congés ${d.conges.annee}</div>
    <table>
      <thead><tr><th>Type</th><th>Acquis</th><th>Pris</th><th>Restant</th></tr></thead>
      <tbody>${rows || `<tr class="empty-row"><td colspan="4">Aucun solde enregistré.</td></tr>`}</tbody>
    </table>
  </div>`
}

function notesRhHtml(d: FichePersonnelData): string {
  return `
  <div class="panel">
    <div class="panel-title">Notes RH (usage interne)</div>
    <div class="bio">${d.notesRh && d.notesRh.trim() ? d.notesRh : '<span style="color:#9ca3af">Aucune note.</span>'}</div>
  </div>`
}

export function construireFichePersonnelHtml(d: FichePersonnelData): string {
  const dateFinPeriode = d.archived && d.archivedAt ? d.archivedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const { anciennete, salaireCumule } = calculerAnciennenteEtSalaire(d.contrats, dateFinPeriode)
  const scores = d.evaluations.map(e => e.score_moyen).filter((s): s is number => s != null)
  const scoreMoyen = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche Personnel — ${d.prenoms} ${d.nom}</title>
  <style>${STYLE}</style>
</head>
<body>
  <div class="page1">
    ${headerHtml(d)}
    ${heroHtml(d)}
    ${kpisHtml(d, anciennete, salaireCumule, scoreMoyen)}
    <div class="cols">
      ${identificationHtml(d)}
      ${coordonneesHtml(d)}
    </div>
    ${bioHtml(d)}
  </div>
  <div class="page2">
    ${headerHtml(d)}
    ${contratsTableHtml(d)}
    ${evaluationsTableHtml(d)}
    <div class="cols">
      ${congesHtml(d)}
      ${notesRhHtml(d)}
    </div>
    <div class="footer-note">
      Document généré automatiquement par My ABED — usage interne RH. Le salaire cumulé est une estimation basée sur l'historique des contrats (taux × durée), pas un relevé comptable certifié.
    </div>
  </div>
</body>
</html>`
}

export async function genererFichePersonnelPdf(d: FichePersonnelData): Promise<Buffer> {
  const html = construireFichePersonnelHtml(d)
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
        <div style="width:100%;font-size:8px;text-align:center;color:#888;font-family:Arial,sans-serif;padding-bottom:6px;">
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

export function nomFichierFichePersonnel(nom: string, prenoms: string): string {
  const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')
  return `Fiche_Personnel_${safe(nom)}_${safe(prenoms)}.pdf`
}
