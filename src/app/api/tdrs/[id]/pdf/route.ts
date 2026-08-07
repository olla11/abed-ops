import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { formatSignatureDisplayName } from '@/lib/signature-name'
import { CHAPITRE_CLES, labelSignataireRole, type Chapitre, type SignataireRole } from '@/lib/tdr'
import { sanitizeChapitreTexte } from '@/lib/tdr-sanitize'
import { BRITTANY_SIGNATURE_FONT_DATA_URI } from '@/lib/signature-font-data'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// Rendu via Chromium headless (au lieu du "Imprimer" du navigateur) — c'est
// le seul moyen d'obtenir un vrai fichier PDF avec marges/pagination fixées
// par le serveur : un numéro de page centré sur chaque page (Chrome
// n'autorise pas une page web à contrôler son propre pied de page pendant
// une impression déclenchée depuis le navigateur).
export const runtime = 'nodejs'
export const maxDuration = 60

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderTexte(texte: string | undefined): string {
  const propre = sanitizeChapitreTexte(texte).trim()
  if (!propre || propre === '<p></p>') return '<p class="muted">—</p>'
  return `<div class="rte-content">${propre}</div>`
}

// Un tableau "prévu pour être rempli" (budget, chronogramme...) démarre avec
// des colonnes mais aucune ligne. Si quelqu'un ajoute une ligne sans la
// remplir (ou la vide après coup), on ne veut pas l'afficher non plus dans
// le document final — seul un tableau avec au moins une cellule renseignée
// compte comme "rempli".
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

// Un chapitre "tableau" a deux zones de contenu (texte libre + tableau
// structuré) — certains chapitres n'utilisent que l'une des deux (ex. des
// tableaux dessinés directement dans le texte riche plutôt que via la zone
// structurée). Le "—" de secours ne doit apparaître que si les DEUX zones
// sont vides, jamais en plus d'un contenu déjà rempli dans l'autre.
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exclureCles = new Set((req.nextUrl.searchParams.get('exclure') ?? '').split(',').filter(Boolean))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr, error } = await supabase
    .from('tdrs')
    .select(`*,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms, fonction),
      signataires:tdr_signataires(role, statut, signe_le, commentaire, profile:profiles!tdr_signataires_profile_id_fkey(id, nom, prenoms, civilite))
    `)
    .eq('id', id)
    .single()

  if (error || !tdr) return NextResponse.json({ error: 'TDR introuvable ou accès refusé' }, { status: 404 })

  // Le document est téléchargeable à tout moment (avec les modalités de
  // masquage ci-dessus) ; tant que le TDR n'est pas actif/clôturé, il s'agit
  // d'un aperçu de brouillon — les signatures manquantes n'ont pas encore
  // toutes été données.
  const apercu = tdr.statut !== 'actif' && tdr.statut !== 'cloture'

  const chapitresOrdonnes: Chapitre[] = CHAPITRE_CLES
    .map(cle => (tdr.chapitres as Chapitre[]).find(c => c.cle === cle))
    .filter((c): c is Chapitre => !!c)
    .filter(c => !exclureCles.has(c.cle))

  const signataireParRole = (role: SignataireRole) =>
    (tdr.signataires as any[]).find(s => s.role === role)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>TDR ${esc(tdr.numero ?? '')} — ${esc(tdr.titre_activite)}</title>
<style>
  @font-face { font-family: 'BrittanySignature'; src: url('${BRITTANY_SIGNATURE_FONT_DATA_URI}') format('truetype'); font-weight: normal; font-style: normal; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #111827; padding: 0; margin: 0; line-height: 1.55; }
  .apercu-banner { font-size: 10pt; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 14px; margin-bottom: 18px; font-family: Arial, sans-serif; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 14px; margin-bottom: 20px; }
  .header img { height: 64px; }
  .org-text { text-align: center; flex: 1; }
  .org-name { font-size: 11pt; font-weight: bold; }
  .org-sub { font-size: 8pt; color: #555; margin-top: 4px; }
  h1.titre-doc { text-align: center; font-size: 15pt; letter-spacing: 2px; margin: 0 0 18px; }
  .meta { background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 10.5pt; }
  .meta div { margin-bottom: 4px; }
  h2.chapitre-titre { font-size: 12.5pt; color: #14532d; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 28px 0 10px; break-after: avoid; page-break-after: avoid; }
  p { margin: 0 0 10px; text-align: justify; }
  ul { margin: 0 0 10px; padding-left: 22px; }
  .muted { color: #9ca3af; font-style: italic; }
  /* Un tableau reste groupé sur une même page tant qu'il y tient ; s'il est
     plus grand qu'une page entière, il se scinde proprement entre deux
     lignes (jamais au milieu d'une ligne) et son en-tête se répète en haut
     de la page suivante. */
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
  .sig-block { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-top: 50px; page-break-inside: avoid; }
  .sig { text-align: center; width: 22%; min-width: 150px; }
  .sig-role { font-size: 9pt; font-weight: bold; margin-bottom: 4px; min-height: 26px; }
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
  ${apercu ? '<div class="apercu-banner">👁️ Aperçu — brouillon : les signatures manquantes apparaîtront une fois complétées.</div>' : ''}

  <div class="header">
    <img src="data:image/png;base64,${LOGO_PNG_B64}" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable (ABED-ONG)</div>
      <div class="org-sub">Parakou, Wanssirou, derrière le lycée MB &nbsp;·&nbsp; Tél. : +229 0167779141<br>Email : contact@abedong.org &nbsp;|&nbsp; abedong.org</div>
    </div>
    <img src="data:image/png;base64,${LOGO_PNG_B64}" alt="Logo ABED">
  </div>

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

  <div class="footer">ABED ONG · Parakou, Bénin · Système de gestion des TDR</div>
</body>
</html>`

  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    // Le HTML est entièrement autonome (logo + police de signature en
    // data URI) — 'load' suffit, pas besoin d'attendre le réseau.
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      // Marges standard d'un document Word ("Normal" : 2,54 cm partout).
      margin: { top: '2.54cm', bottom: '2.54cm', left: '2.54cm', right: '2.54cm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;text-align:center;color:#888;font-family:Georgia,'Times New Roman',serif;">
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    })

    const nomFichier = `TDR-${(tdr.numero ?? tdr.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomFichier}"`,
      },
    })
  } finally {
    await browser.close()
  }
}
