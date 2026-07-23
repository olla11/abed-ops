import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { formatSignatureDisplayName } from '@/lib/signature-name'
import { CHAPITRE_CLES, labelSignataireRole, type Chapitre, type SignataireRole } from '@/lib/tdr'
import { sanitizeChapitreTexte } from '@/lib/tdr-sanitize'
import { BRITTANY_SIGNATURE_FONT_DATA_URI } from '@/lib/signature-font-data'

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderTexte(texte: string | undefined): string {
  const propre = sanitizeChapitreTexte(texte).trim()
  if (!propre || propre === '<p></p>') return '<p class="muted">—</p>'
  return `<div class="rte-content">${propre}</div>`
}

function renderTableau(tableau: Chapitre['tableau']): string {
  if (!tableau || tableau.lignes.length === 0) {
    return '<p class="muted">—</p>'
  }
  return `
    <table class="chapitre-table">
      <thead><tr>${tableau.colonnes.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${tableau.lignes.map(ligne => `<tr>${ligne.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const chapitresOrdonnes: Chapitre[] = CHAPITRE_CLES
    .map(cle => (tdr.chapitres as Chapitre[]).find(c => c.cle === cle))
    .filter((c): c is Chapitre => !!c)

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
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #111827; padding: 32px 40px; max-width: 820px; margin: 0 auto; line-height: 1.55; }
  .no-print { text-align: center; margin-bottom: 20px; }
  .no-print button { background: #16a34a; color: white; border: none; border-radius: 8px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 14px; margin-bottom: 20px; }
  .header img { height: 64px; }
  .org-text { text-align: center; flex: 1; }
  .org-name { font-size: 11pt; font-weight: bold; }
  .org-sub { font-size: 8pt; color: #555; margin-top: 4px; }
  h1.titre-doc { text-align: center; font-size: 15pt; letter-spacing: 2px; margin: 0 0 18px; }
  .meta { background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 10.5pt; }
  .meta div { margin-bottom: 4px; }
  h2.chapitre-titre { font-size: 12.5pt; color: #14532d; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 28px 0 10px; }
  p { margin: 0 0 10px; text-align: justify; }
  ul { margin: 0 0 10px; padding-left: 22px; }
  .muted { color: #9ca3af; font-style: italic; }
  table.chapitre-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
  table.chapitre-table th, table.chapitre-table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.chapitre-table th { background: #f0fdf4; font-weight: bold; }
  .rte-content a { color: #2563eb; }
  .rte-content ul, .rte-content ol { margin: 0 0 10px; padding-left: 22px; }
  .rte-content table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
  .rte-content table th, .rte-content table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  .rte-content table th { background: #f0fdf4; font-weight: bold; }
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
  @media print { .no-print { display: none !important; } body { padding: 24px 32px; } }
</style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">🖨️ Imprimer / Télécharger en PDF</button></div>

  <div class="header">
    <img src="/logoabed2.png" alt="Logo ABED">
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable (ABED-ONG)</div>
      <div class="org-sub">Parakou, Wanssirou, derrière le lycée MB &nbsp;·&nbsp; Tél. : +229 0167779141<br>Email : contact@abedong.org &nbsp;|&nbsp; abedong.org</div>
    </div>
    <img src="/logoabed2.png" alt="Logo ABED">
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
    ${c.type === 'tableau' ? renderTableau(c.tableau) : renderTexte(c.texte)}
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

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
