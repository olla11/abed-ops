import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contrat, error } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, civilite, role, fonction)')
    .eq('id', id)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const me = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = me.data?.role ?? ''
  const canView = ['rh', 'admin', 'de', 'administrateur', 'aaf', 'caf'].includes(role) || contrat.profile_id === user.id
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const p = contrat.profile as any
  const isDE = p?.role === 'de'
  const categorie = contrat.categorie_document ?? 'Contrat'
  const representantEmployeur = isDE ? "Président du Conseil d'Administration" : 'Directeur Exécutif'
  const sigLeft = isDE ? "Le Président du Conseil d'Administration" : "Le Directeur Exécutif"
  const sigRight = `${p?.civilite ?? ''} ${p?.prenoms ?? ''} ${p?.nom ?? ''}`
  const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'
  const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : 'Indéterminée'
  const today = new Date().toLocaleDateString('fr-FR')

  const articles: Array<{ titre: string; contenu: string }> = Array.isArray(contrat.articles) ? contrat.articles : []

  const articlesHtml = articles.length > 0
    ? articles.map((art, i) => `
      <div class="article">
        <div class="article-title">Article ${i + 1} — ${art.titre || ''}</div>
        <div class="article-body">${(art.contenu || '').replace(/\n/g, '<br/>')}</div>
      </div>`).join('')
    : ''

  const commentsHtml = contrat.commentaires_employe || contrat.commentaires_rh
    ? `
    <div class="section">
      <h2>Commentaires</h2>
      ${contrat.commentaires_rh ? `<div class="row"><span class="label">Note RH :</span><span class="value">${contrat.commentaires_rh}</span></div>` : ''}
      ${contrat.commentaires_employe ? `<div class="row"><span class="label">Note employé :</span><span class="value">${contrat.commentaires_employe}</span></div>` : ''}
    </div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${categorie} ${contrat.numero ?? ''} — ${p?.prenoms} ${p?.nom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #111; background: #fff; padding: 48px 56px; max-width: 820px; margin: 0 auto; }
    .no-print { text-align: center; margin-bottom: 24px; }
    .no-print button { padding: 10px 24px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
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
    .parties-block { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
    .party { border: 1px solid #ccc; border-radius: 4px; padding: 12px 16px; }
    .party-head { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #16a34a; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .party-body { font-size: 10.5pt; line-height: 1.7; }
    .article { margin-bottom: 16px; }
    .article-title { font-size: 11pt; font-weight: bold; margin-bottom: 4px; }
    .article-body { font-size: 10.5pt; line-height: 1.8; text-align: justify; }
    .sig-block { display: flex; justify-content: space-between; margin-top: 64px; }
    .sig { text-align: center; width: 45%; }
    .sig-role { font-size: 10pt; font-weight: bold; margin-bottom: 4px; }
    .sig-line { border-top: 1px solid #000; margin-top: 52px; padding-top: 6px; font-size: 10pt; }
    .footer { text-align: center; font-size: 8.5pt; color: #888; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { .no-print { display: none !important; } body { padding: 24px 32px; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimer / Télécharger en PDF</button>
  </div>

  <div class="header">
    <img src="/logoabed2.png" alt="Logo ABED" />
    <div class="org-text">
      <div class="org-name">Agriculture pour le Bien-être et le Développement Durable</div>
      <div class="org-acronym">(ABED-ONG)</div>
      <div class="org-sub">
        Enregistrée sous le N° 2019-4/0008 /PDB/SG/SAG du 16 Janvier 2019<br>
        Parakou – Bénin &nbsp;·&nbsp; Tél. : +229 0167779141<br>
        Email : contact@abedong.org &nbsp;|&nbsp; abedcontactpk@gmail.com
      </div>
    </div>
  </div>

  <div class="doc-title">
    <h1>${categorie} de ${contrat.type_contrat}</h1>
  </div>
  <div class="doc-ref">
    Réf. : <strong>${contrat.numero ?? 'N/A'}</strong> &nbsp;·&nbsp; Parakou, le ${today}
  </div>

  ${contrat.objet ? `
  <div class="section">
    <h2>Objet</h2>
    <p style="font-size:11pt;line-height:1.8;">${contrat.objet}</p>
  </div>` : ''}

  <div class="section">
    <h2>Entre les parties</h2>
    <div class="parties-block">
      <div class="party">
        <div class="party-head">L'Employeur</div>
        <div class="party-body">
          <strong>ABED ONG</strong><br>
          Représentée par son ${representantEmployeur}<br>
          Parakou, Bénin<br>
          ci-après dénommée <em>« l'Employeur »</em>
        </div>
      </div>
      <div class="party">
        <div class="party-head">L'Employé(e)</div>
        <div class="party-body">
          <strong>${p?.civilite ?? ''} ${p?.prenoms ?? ''} ${p?.nom ?? ''}</strong><br>
          ${p?.fonction ? `Fonction : ${p.fonction}<br>` : ''}
          ci-après dénommé(e) <em>« l'Employé(e) »</em>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Conditions du ${categorie.toLowerCase()}</h2>
    <div class="row"><span class="label">Type :</span><span class="value">${contrat.type_contrat}</span></div>
    ${contrat.poste ? `<div class="row"><span class="label">Poste :</span><span class="value">${contrat.poste}</span></div>` : ''}
    ${contrat.direction ? `<div class="row"><span class="label">Direction :</span><span class="value">${contrat.direction}</span></div>` : ''}
    <div class="row"><span class="label">Date de prise d'effet :</span><span class="value">${dateDebut}</span></div>
    <div class="row"><span class="label">Date d'échéance :</span><span class="value">${dateFin}</span></div>
    ${contrat.salaire_brut ? `<div class="row"><span class="label">Rémunération brute :</span><span class="value">${Number(contrat.salaire_brut).toLocaleString('fr-FR')} FCFA / mois</span></div>` : ''}
    ${contrat.observations ? `<div class="row"><span class="label">Observations :</span><span class="value">${contrat.observations}</span></div>` : ''}
  </div>

  ${articlesHtml ? `
  <div class="section">
    <h2>Dispositions particulières</h2>
    ${articlesHtml}
  </div>` : ''}

  ${commentsHtml}

  <p style="font-size:10.5pt;margin-top:24px;text-align:justify;">
    Les parties déclarent avoir pris connaissance des présentes dispositions et s'engagent à les respecter.
  </p>

  <div class="sig-block">
    <div class="sig">
      <div class="sig-role">${sigLeft}</div>
      <div class="sig-line">Signature &amp; Cachet</div>
    </div>
    <div class="sig">
      <div class="sig-role">${sigRight}</div>
      <div class="sig-line">Lu et approuvé</div>
    </div>
  </div>

  <div class="footer">ABED ONG · Parakou, Bénin · Système de gestion RH</div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
