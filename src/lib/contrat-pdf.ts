// Génération du PDF d'un contrat/convention RH — rendu via Chromium headless
// (au lieu du "Imprimer" du navigateur) pour obtenir un vrai fichier PDF,
// même logique que src/lib/tdr-pdf.ts.

import { formatSignatureDisplayName } from '@/lib/signature-name'
import { BRITTANY_SIGNATURE_FONT_DATA_URI } from '@/lib/signature-font-data'
import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export interface ContratPdfArticle {
  titre: string
  contenu: string
}

export interface ContratPdfData {
  numero: string | null
  categorie: string
  typeContrat: string
  poste: string | null
  direction: string | null
  dateDebut: string
  dateFin: string
  today: string
  parentNumero: string | null
  objet: string | null
  articles: ContratPdfArticle[]
  observations: string | null
  salaireBrut: number | null
  representantEmployeur: string
  sigLeft: string
  sigRight: string
  repNom: string
  repTel: string
  repEmail: string
  repAdresse: string
  repCachetUrl: string | null
  employeCivilite: string | null
  employePrenoms: string
  employeNom: string
  employeTelephone: string | null
  employeEmail: string | null
  employeAdresse: string | null
  employeSigneLe: string | null
  signataireNom: string | null
  signataireNomReel: string
  signataireSigneLe: string | null
  partieEmploye: string
}

function accordE(civilite: string | null | undefined): string {
  return civilite === 'Mme' ? 'e' : ''
}
function titreDirecteur(civilite: string | null | undefined): string {
  return civilite === 'Mme' ? 'La Directrice Exécutive' : 'Le Directeur Exécutif'
}
// Les prestataires sont payés à l'heure (taux CAF), pas sur un salaire fixe mensuel
function isPrestataireType(typeContrat: string | null | undefined): boolean {
  return (typeContrat ?? '').toLowerCase().includes('prestataire')
}

// Bloc de signature : le nom manuscrit (cursif) repose sur le trait, le nom réel imprimé apparaît en dessous
function sigBlockHtml(role: string, nomCursif: string | null, nomReel: string, dateStr: string | null, avant = ''): string {
  return `
    <div class="sig">
      <div class="sig-role">${role}</div>
      ${avant}
      <div class="sig-area">${nomCursif ? `<div class="sig-cursive">${nomCursif}</div>` : ''}</div>
      <div class="sig-rule"></div>
      ${nomCursif
        ? `<div class="sig-realname">${nomReel}</div><div class="sig-stamp">✓ Signé électroniquement${dateStr ? ` le ${dateStr}` : ''}</div>`
        : `<div class="sig-pending">En attente de signature</div>`}
    </div>`
}

export function construireContratHtml(d: ContratPdfData): string {
  const { categorie } = d
  const isOffreStage = categorie === 'Offre de stage'
  const objetApresParties = categorie === 'Convention' || categorie === 'Avenant'

  const articlesHtml = d.articles.length > 0
    ? d.articles.map((art, i) => `
      <div class="article">
        <div class="article-title">${categorie === 'Avenant' ? (art.titre || '') : `Article ${i + 1} — ${art.titre || ''}`}</div>
        <div class="article-body">${(art.contenu || '').replace(/\n/g, '<br/>')}</div>
      </div>`).join('')
    : ''

  const objetHtml = d.objet ? `
  <div class="section">
    <h2>Objet</h2>
    <p style="font-size:11pt;line-height:1.8;">${d.objet.replace(/\n/g, '<br/>')}</p>
  </div>` : ''

  const clauseClotureHtml = categorie === 'Avenant' ? `
  <p style="font-size:10.5pt;margin-top:24px;text-align:justify;">
    Cet avenant${d.numero ? ` numéro ${d.numero}` : ''} modifie la convention initiale, et tous deux doivent être lus ensemble et
    constituent une seule convention, de même que tout avenant précédent et ultérieur.
  </p>
  <p style="font-size:10.5pt;margin-top:12px;text-align:justify;">
    Toutes les obligations, termes et conditions contenues dans la convention restent en vigueur jusqu'à la fin de la
    convention, à moins de modification contraire dans les présentes.
  </p>` : `
  <p style="font-size:10.5pt;margin-top:24px;text-align:justify;">
    Les parties déclarent avoir pris connaissance des présentes dispositions et s'engagent à les respecter.
  </p>`

  const p = { civilite: d.employeCivilite, prenoms: d.employePrenoms, nom: d.employeNom, telephone: d.employeTelephone, email: d.employeEmail, adresse: d.employeAdresse }
  const employeNomReel = `${d.employePrenoms} ${d.employeNom}`.trim()

  const corpsHtml = isOffreStage ? `
  <div class="doc-title">
    <h1>Offre de stage</h1>
  </div>
  <div class="doc-ref">
    Réf. : <strong>${d.numero ?? 'N/A'}</strong> &nbsp;·&nbsp; Parakou, le ${d.today}
  </div>

  <p class="lettre-corps"><strong>Objet : Offre de stage</strong></p>

  <p class="lettre-corps">${p.civilite ?? ''}, ${p.prenoms ?? ''} ${p.nom ?? ''},</p>

  <p class="lettre-corps">
    En référence à votre candidature au poste de stagiaire ${d.poste ?? ''}, et pour donner suite à l'entretien,
    nous avons le plaisir de vous informer que vous êtes retenu${accordE(p.civilite)} pour effectuer un stage
    professionnel au sein de notre organisation, à compter du ${d.dateDebut}.
  </p>

  ${d.direction ? `<p class="lettre-corps">Vous effectuerez ce stage au sein de notre ${d.direction}.</p>` : ''}

  ${d.objet ? `<p class="lettre-corps">${d.objet.replace(/\n/g, '<br/>')}</p>` : ''}

  ${d.salaireBrut ? `<p class="lettre-corps">Une allocation mensuelle de ${Number(d.salaireBrut).toLocaleString('fr-FR')} FCFA vous sera versée durant cette période.</p>` : ''}

  ${d.observations ? `<p class="lettre-corps">${d.observations.replace(/\n/g, '<br/>')}</p>` : ''}

  ${articlesHtml ? `<div class="section"><h2>Dispositions particulières</h2>${articlesHtml}</div>` : ''}

  <p class="lettre-corps">
    Nous vous prions de signer cette offre et de nous la retourner dans les plus brefs délais si elle vous convient.
  </p>
  <p class="lettre-corps">
    Espérant que ce stage vous permettra d'apprendre et de développer de nouvelles compétences, nous vous souhaitons
    une riche période d'apprentissage au sein de notre organisation.
  </p>

  <div class="sig-block">
    ${sigBlockHtml(`Pour ${p.civilite === 'Mme' ? 'la' : 'le'} stagiaire`, d.employeSigneLe ? formatSignatureDisplayName(p.prenoms, p.nom) : null, employeNomReel, d.employeSigneLe)}
    ${sigBlockHtml(titreDirecteur(null), d.signataireNom, d.signataireNomReel, d.signataireSigneLe, d.repCachetUrl ? `<img src="${d.repCachetUrl}" alt="Cachet ABED" style="height:70px;margin-top:8px;" />` : '')}
  </div>
  ` : `
  <div class="doc-title">
    <h1>${categorie} de ${d.typeContrat}</h1>
  </div>
  <div class="doc-ref">
    Réf. : <strong>${d.numero ?? 'N/A'}</strong> &nbsp;·&nbsp; Parakou, le ${d.today}
    ${categorie === 'Avenant' && d.parentNumero ? `<br/>À la convention N° <strong>${d.parentNumero}</strong>` : ''}
  </div>

  ${!objetApresParties ? objetHtml : ''}

  <div class="section">
    <h2>Entre les soussignés</h2>
    <p class="preambule">
      <strong>ABED-ONG</strong>, représentée par son ${d.representantEmployeur}, ${d.repNom}, Tél ${d.repTel}, Email : ${d.repEmail}, demeurant à ${d.repAdresse}, et ci-après dénommée <strong>« ABED »</strong>, d'une part,
    </p>
    <p class="preambule">Et</p>
    <p class="preambule">
      <strong>${p.civilite ?? ''} ${p.prenoms ?? ''} ${p.nom ?? ''}</strong>, Tél ${p.telephone ?? '—'}, Email : ${p.email ?? '—'}, demeurant à ${p.adresse ?? '—'}, Rép. Bénin, ci-après dénommé(e) <strong>« ${d.partieEmploye} »</strong>, d'autre part.
    </p>
    <p class="preambule">
      « <strong>ABED-ONG</strong> » et le « <strong>${d.partieEmploye}</strong> » désignent collectivement les parties.
    </p>
  </div>

  ${objetApresParties ? objetHtml : ''}

  <div class="section">
    <h2>Conditions du ${categorie.toLowerCase()}</h2>
    <div class="row"><span class="label">Type :</span><span class="value">${d.typeContrat}</span></div>
    ${d.poste ? `<div class="row"><span class="label">Poste :</span><span class="value">${d.poste}</span></div>` : ''}
    ${d.direction ? `<div class="row"><span class="label">Direction :</span><span class="value">${d.direction}</span></div>` : ''}
    <div class="row"><span class="label">Date de prise d'effet :</span><span class="value">${d.dateDebut}</span></div>
    <div class="row"><span class="label">Date d'échéance :</span><span class="value">${d.dateFin}</span></div>
    ${d.salaireBrut ? `<div class="row"><span class="label">${isPrestataireType(d.typeContrat) ? 'Taux horaire (CAF)' : 'Rémunération brute'} :</span><span class="value">${Number(d.salaireBrut).toLocaleString('fr-FR')} FCFA${isPrestataireType(d.typeContrat) ? ' / heure' : ' / mois'}</span></div>` : ''}
    ${d.observations ? `<div class="row"><span class="label">Observations :</span><span class="value">${d.observations}</span></div>` : ''}
  </div>

  ${articlesHtml ? `
  <div class="section">
    <h2>Dispositions particulières</h2>
    ${articlesHtml}
  </div>` : ''}

  ${clauseClotureHtml}

  <div class="sig-block">
    ${sigBlockHtml(d.sigLeft, d.signataireNom, d.signataireNomReel, d.signataireSigneLe)}
    ${sigBlockHtml(d.sigRight, d.employeSigneLe ? formatSignatureDisplayName(p.prenoms, p.nom) : null, employeNomReel, d.employeSigneLe)}
  </div>
  `

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${categorie} ${d.numero ?? ''} — ${d.employePrenoms} ${d.employeNom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #111; background: #fff; padding: 48px 56px; max-width: 820px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px double #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
    .header img { height: 72px; width: auto; flex-shrink: 0; }
    .header .org-text { flex: 1; text-align: center; }
    .header .org-name { font-size: 12.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #111; }
    .header .org-acronym { font-size: 13pt; font-weight: bold; margin-top: 2px; }
    .header .org-sub { font-size: 8.5pt; color: #555; margin-top: 3px; line-height: 1.5; }
    .doc-title { text-align: center; margin: 20px 0 8px; }
    .doc-title h1 { font-size: 15pt; text-transform: uppercase; letter-spacing: 2px; border: 2px solid #111; display: inline-block; padding: 6px 24px; }
    .doc-ref { text-align: center; font-size: 10pt; color: #555; margin-bottom: 28px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 10.5pt; text-transform: uppercase; font-weight: bold; border-bottom: 1.5px solid #222; padding-bottom: 3px; margin-bottom: 10px; letter-spacing: 1px; }
    .row { display: flex; gap: 12px; margin-bottom: 6px; font-size: 11pt; }
    .label { font-weight: bold; min-width: 170px; }
    .value { flex: 1; }
    .preambule { font-size: 11pt; line-height: 1.9; text-align: justify; margin-bottom: 10px; }
    .lettre-corps { font-size: 11pt; line-height: 1.9; text-align: justify; margin-bottom: 14px; }
    .article { margin-bottom: 16px; }
    .article-title { font-size: 11pt; font-weight: bold; margin-bottom: 4px; }
    .article-body { font-size: 10.5pt; line-height: 1.8; text-align: justify; }
    @font-face { font-family: 'BrittanySignature'; src: url('${BRITTANY_SIGNATURE_FONT_DATA_URI}') format('truetype'); font-weight: normal; font-style: normal; }
    .sig-block { display: flex; justify-content: space-between; margin-top: 64px; }
    .sig { text-align: center; width: 45%; }
    .sig-role { font-size: 10pt; font-weight: bold; margin-bottom: 4px; }
    .sig-area { min-height: 54px; margin-top: 30px; display: flex; align-items: flex-end; justify-content: center; }
    .sig-cursive { font-family: 'BrittanySignature', cursive; font-size: 28pt; line-height: 1; color: #1e3a8a; transform: translateY(-16px); }
    .sig-rule { border-top: 1px solid #000; }
    .sig-realname { font-size: 10.5pt; font-weight: bold; margin-top: 14px; color: #111; }
    .sig-pending { font-size: 10pt; color: #9ca3af; margin-top: 6px; }
    .sig-stamp { font-size: 8.5pt; color: #16a34a; margin-top: 3px; font-family: Arial, sans-serif; font-weight: bold; }
    .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable</div>
      <div class="org-acronym">(ABED-ONG)</div>
      <div class="org-sub">
        Enregistrée sous le N° 2019-4/0008 /PDB/SG/SAG du 16 Janvier 2019<br>
        Parakou, Quartier Zongo, Troisième vons après le CS/Zongo, Bénin &nbsp;·&nbsp; Tél. : +229 0167779141<br>
        Email : contact@abedong.org &nbsp;|&nbsp; abedcontactpk@gmail.com
      </div>
    </div>
    <img src="data:image/png;base64,${LOGO_COLOR_PNG_B64}" alt="Logo ABED">
  </div>

  ${corpsHtml}

  <div class="footer">ABED ONG · Parakou, Quartier Zongo, Bénin · Système de gestion RH</div>
</body>
</html>`
}

export async function genererContratPdf(d: ContratPdfData): Promise<Buffer> {
  const html = construireContratHtml(d)
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
      margin: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

export function nomFichierContratPdf(categorie: string, numero: string | null, id: string): string {
  return `${categorie}-${(numero ?? id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
}
