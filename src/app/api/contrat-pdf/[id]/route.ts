import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Rendu "manuscrit" de la signature : premier prénom seulement, tout en minuscules
function formatSignatureName(prenoms: string | null | undefined, nom: string | null | undefined): string {
  const premierPrenom = (prenoms ?? '').trim().split(/\s+/)[0] ?? ''
  const n = (nom ?? '').trim()
  return `${premierPrenom} ${n}`.toLowerCase().trim()
}

// Désignation de la partie employé dans le préambule, selon le type de contrat
function partieLabel(typeContrat: string | null | undefined): string {
  const t = (typeContrat ?? '').toLowerCase()
  if (t.includes('bénévol')) return 'Bénévole'
  if (t.includes('stage') || t.includes('stagiaire')) return 'Stagiaire'
  if (t.includes('prestataire')) return 'Prestataire'
  if (t.includes('consultant')) return 'Consultant'
  return 'Employé(e)'
}

// Accord de genre en fonction de la civilité (Mme → féminin)
function accordE(civilite: string | null | undefined): string {
  return civilite === 'Mme' ? 'e' : ''
}
function titreDirecteur(civilite: string | null | undefined): string {
  return civilite === 'Mme' ? 'La Directrice Exécutive' : 'Le Directeur Exécutif'
}
function dureeMois(debut: string | null | undefined, fin: string | null | undefined): string {
  if (!debut || !fin) return ''
  const d1 = new Date(debut), d2 = new Date(fin)
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
  return months > 0 ? `${months} mois` : ''
}

// Les prestataires sont payés à l'heure (taux CAF), pas sur un salaire fixe mensuel
function isPrestataireType(typeContrat: string | null | undefined): boolean {
  return (typeContrat ?? '').toLowerCase().includes('prestataire')
}

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
    .select('*, profile:profiles!profile_id(id, nom, prenoms, civilite, role, fonction, telephone, email, adresse)')
    .eq('id', id)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const me = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = me.data?.role ?? ''
  const canView = ['rh', 'admin', 'de', 'administrateur', 'aaf', 'caf'].includes(role) || contrat.profile_id === user.id
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Backfill : certains contrats plus anciens n'ont jamais reçu de numero (échec silencieux à la création)
  let numero = contrat.numero as string | null
  if (!numero) {
    const year = new Date().getFullYear()
    const { data: seqData, error: seqError } = await admin
      .rpc('nextval_contrats_seq' as Parameters<typeof admin.rpc>[0])
    if (!seqError && seqData != null) {
      numero = `${String(Number(seqData)).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
    } else {
      const { count } = await admin.from('contrats').select('id', { count: 'exact', head: true })
      numero = `${String(count ?? 1).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
    }
    const { error: numeroErr } = await admin.from('contrats').update({ numero }).eq('id', id)
    if (numeroErr) console.error('[contrat-pdf] échec backfill numero:', numeroErr)
  }

  const p = contrat.profile as any
  const isDE = p?.role === 'de'
  const categorie = contrat.categorie_document ?? 'Contrat'
  const representantEmployeur = isDE ? "Président du Conseil d'Administration" : 'Directeur Exécutif'
  const sigLeft = isDE ? "Le Président du Conseil d'Administration" : "Le Directeur Exécutif"
  const partieEmploye = partieLabel(contrat.type_contrat)
  const sigRight = partieEmploye === 'Employé(e)' ? "L'Employé(e)" : `${p?.civilite === 'Mme' ? 'La' : 'Le'} ${partieEmploye}`
  const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'
  const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : 'Indéterminée'
  const today = new Date().toLocaleDateString('fr-FR')
  const partie = partieEmploye

  // Représentant d'ABED : le DE, sauf si le contrat concerne le DE lui-même → le PCA
  const { data: repProfile } = await admin
    .from('profiles')
    .select('nom, prenoms, civilite, telephone, email, adresse, cachet_url')
    .eq('role', isDE ? 'administrateur' : 'de')
    .single()
  const repNom = `${repProfile?.prenoms ?? ''} ${repProfile?.nom ?? ''}`.trim() || '—'
  const repTel = repProfile?.telephone ?? '—'
  const repEmail = repProfile?.email ?? '—'
  const repAdresse = repProfile?.adresse ?? 'Parakou, Bénin'

  // Cachet du représentant (utilisé pour l'offre de stage, signée par le DE)
  let repCachetUrl: string | null = null
  if (repProfile?.cachet_url) {
    const { data: signedUrlData } = await admin.storage.from('assets').createSignedUrl(repProfile.cachet_url, 3600)
    repCachetUrl = signedUrlData?.signedUrl ?? null
  }

  // Statut de signature de l'employé
  const employeSigneLe = contrat.signe_employe_le
    ? new Date(contrat.signe_employe_le).toLocaleDateString('fr-FR')
    : null

  // Statut de signature du signataire (DE / PCA / autre) côté employeur.
  // Source de vérité : contrat.workflow_statut + contrat.signataire_id (jamais le circuit
  // générique demandes_signature/signataires, qui peut être absent ou désynchronisé).
  let signataireNom: string | null = null
  let signataireSigneLe: string | null = null
  if (contrat.signataire_id && ['signe_signataire', 'finalise'].includes(contrat.workflow_statut ?? '')) {
    const { data: sigProfile } = await admin
      .from('profiles')
      .select('nom, prenoms')
      .eq('id', contrat.signataire_id)
      .single()
    signataireNom = formatSignatureName(sigProfile?.prenoms, sigProfile?.nom)

    if (contrat.signe_signataire_le) {
      signataireSigneLe = new Date(contrat.signe_signataire_le).toLocaleDateString('fr-FR')
    }
  }

  const articles: Array<{ titre: string; contenu: string }> = Array.isArray(contrat.articles) ? contrat.articles : []

  const articlesHtml = articles.length > 0
    ? articles.map((art, i) => `
      <div class="article">
        <div class="article-title">Article ${i + 1} — ${art.titre || ''}</div>
        <div class="article-body">${(art.contenu || '').replace(/\n/g, '<br/>')}</div>
      </div>`).join('')
    : ''

  const commentsHtml = contrat.commentaires_employe || contrat.commentaires_rh || contrat.commentaires_signataire
    ? `
    <div class="section">
      <h2>Commentaires</h2>
      ${contrat.commentaires_rh ? `<div class="row"><span class="label">Note RH :</span><span class="value">${contrat.commentaires_rh}</span></div>` : ''}
      ${contrat.commentaires_employe ? `<div class="row"><span class="label">Note employé :</span><span class="value">${contrat.commentaires_employe}</span></div>` : ''}
      ${contrat.commentaires_signataire ? `<div class="row"><span class="label">Note du signataire :</span><span class="value">${contrat.commentaires_signataire}</span></div>` : ''}
    </div>`
    : ''

  const isOffreStage = categorie === 'Offre de stage'

  const corpsHtml = isOffreStage ? `
  <div class="doc-title">
    <h1>Offre de stage</h1>
  </div>
  <div class="doc-ref">
    Réf. : <strong>${numero ?? 'N/A'}</strong> &nbsp;·&nbsp; Parakou, le ${today}
  </div>

  <p class="lettre-corps"><strong>Objet : Offre de stage</strong></p>

  <p class="lettre-corps">${p?.civilite ?? ''}, ${p?.prenoms ?? ''} ${p?.nom ?? ''},</p>

  <p class="lettre-corps">
    En référence à votre candidature au poste de stagiaire ${contrat.poste ?? ''}, et pour donner suite à l'entretien,
    nous avons le plaisir de vous informer que vous êtes retenu${accordE(p?.civilite)} pour effectuer un stage
    professionnel${dureeMois(contrat.date_debut, contrat.date_fin) ? ` de ${dureeMois(contrat.date_debut, contrat.date_fin)}` : ''}
    au sein de notre organisation, à compter du ${dateDebut}.
  </p>

  ${contrat.direction ? `<p class="lettre-corps">Vous effectuerez ce stage au sein de notre ${contrat.direction}.</p>` : ''}

  ${contrat.objet ? `<p class="lettre-corps">${contrat.objet.replace(/\n/g, '<br/>')}</p>` : ''}

  ${contrat.salaire_brut ? `<p class="lettre-corps">Une allocation mensuelle de ${Number(contrat.salaire_brut).toLocaleString('fr-FR')} FCFA vous sera versée durant cette période.</p>` : ''}

  ${contrat.observations ? `<p class="lettre-corps">${contrat.observations.replace(/\n/g, '<br/>')}</p>` : ''}

  ${articlesHtml ? `<div class="section"><h2>Dispositions particulières</h2>${articlesHtml}</div>` : ''}

  <p class="lettre-corps">
    Nous vous prions de signer cette offre et de nous la retourner dans les plus brefs délais si elle vous convient.
  </p>
  <p class="lettre-corps">
    Espérant que ce stage vous permettra d'apprendre et de développer de nouvelles compétences, nous vous souhaitons
    une riche période d'apprentissage au sein de notre organisation.
  </p>

  <div class="sig-block">
    <div class="sig">
      <div class="sig-role">Pour ${p?.civilite === 'Mme' ? 'la' : 'le'} stagiaire</div>
      ${employeSigneLe ? `
        <div class="sig-name">${formatSignatureName(p?.prenoms, p?.nom)}</div>
        <div class="sig-stamp">✓ Signé électroniquement le ${employeSigneLe}</div>
      ` : `<div class="sig-line">En attente de signature</div>`}
    </div>
    <div class="sig">
      <div class="sig-role">${titreDirecteur(repProfile?.civilite)}</div>
      ${repCachetUrl ? `<img src="${repCachetUrl}" alt="Cachet ABED" style="height:70px;margin-top:8px;" />` : ''}
      ${signataireNom ? `
        <div class="sig-name">${signataireNom}</div>
        <div class="sig-stamp">✓ Signé électroniquement${signataireSigneLe ? ` le ${signataireSigneLe}` : ''}</div>
      ` : `<div class="sig-line">En attente de signature</div>`}
    </div>
  </div>
  ` : `
  <div class="doc-title">
    <h1>${categorie} de ${contrat.type_contrat}</h1>
  </div>
  <div class="doc-ref">
    Réf. : <strong>${numero ?? 'N/A'}</strong> &nbsp;·&nbsp; Parakou, le ${today}
  </div>

  ${contrat.objet ? `
  <div class="section">
    <h2>Objet</h2>
    <p style="font-size:11pt;line-height:1.8;">${contrat.objet}</p>
  </div>` : ''}

  <div class="section">
    <h2>Entre les soussignés</h2>
    <p class="preambule">
      <strong>ABED-ONG</strong>, représentée par son ${representantEmployeur}, ${repNom}, Tél ${repTel}, Email : ${repEmail}, demeurant à ${repAdresse}, et ci-après dénommée <strong>« ABED »</strong>, d'une part,
    </p>
    <p class="preambule">Et</p>
    <p class="preambule">
      <strong>${p?.civilite ?? ''} ${p?.prenoms ?? ''} ${p?.nom ?? ''}</strong>, Tél ${p?.telephone ?? '—'}, Email : ${p?.email ?? '—'}, demeurant à ${p?.adresse ?? '—'}, Rép. Bénin, ci-après dénommé(e) <strong>« ${partie} »</strong>, d'autre part.
    </p>
    <p class="preambule">
      « <strong>ABED-ONG</strong> » et le « <strong>${partie}</strong> » désignent collectivement les parties.
    </p>
  </div>

  <div class="section">
    <h2>Conditions du ${categorie.toLowerCase()}</h2>
    <div class="row"><span class="label">Type :</span><span class="value">${contrat.type_contrat}</span></div>
    ${contrat.poste ? `<div class="row"><span class="label">Poste :</span><span class="value">${contrat.poste}</span></div>` : ''}
    ${contrat.direction ? `<div class="row"><span class="label">Direction :</span><span class="value">${contrat.direction}</span></div>` : ''}
    <div class="row"><span class="label">Date de prise d'effet :</span><span class="value">${dateDebut}</span></div>
    <div class="row"><span class="label">Date d'échéance :</span><span class="value">${dateFin}</span></div>
    ${contrat.salaire_brut ? `<div class="row"><span class="label">${isPrestataireType(contrat.type_contrat) ? 'Taux horaire (CAF)' : 'Rémunération brute'} :</span><span class="value">${Number(contrat.salaire_brut).toLocaleString('fr-FR')} FCFA${isPrestataireType(contrat.type_contrat) ? ' / heure' : ' / mois'}</span></div>` : ''}
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
      ${signataireNom ? `
        <div class="sig-name">${signataireNom}</div>
        <div class="sig-stamp">✓ Signé électroniquement${signataireSigneLe ? ` le ${signataireSigneLe}` : ''}</div>
      ` : `<div class="sig-line">En attente de signature</div>`}
    </div>
    <div class="sig">
      <div class="sig-role">${sigRight}</div>
      ${employeSigneLe ? `
        <div class="sig-name">${formatSignatureName(p?.prenoms, p?.nom)}</div>
        <div class="sig-stamp">✓ Signé électroniquement le ${employeSigneLe}</div>
      ` : `<div class="sig-line">En attente de signature</div>`}
    </div>
  </div>
  `

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${categorie} ${numero ?? ''} — ${p?.prenoms} ${p?.nom}</title>
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
    .preambule { font-size: 11pt; line-height: 1.9; text-align: justify; margin-bottom: 10px; }
    .lettre-corps { font-size: 11pt; line-height: 1.9; text-align: justify; margin-bottom: 14px; }
    .article { margin-bottom: 16px; }
    .article-title { font-size: 11pt; font-weight: bold; margin-bottom: 4px; }
    .article-body { font-size: 10.5pt; line-height: 1.8; text-align: justify; }
    @font-face { font-family: 'BrittanySignature'; src: url('/fonts/BrittanySignature.ttf') format('truetype'); font-weight: normal; font-style: normal; }
    .sig-block { display: flex; justify-content: space-between; margin-top: 64px; }
    .sig { text-align: center; width: 45%; }
    .sig-role { font-size: 10pt; font-weight: bold; margin-bottom: 4px; }
    .sig-line { border-top: 1px solid #000; margin-top: 52px; padding-top: 6px; font-size: 10pt; color: #9ca3af; }
    .sig-name { font-family: 'BrittanySignature', cursive; font-size: 28pt; line-height: 1; border-top: 1px solid #000; margin-top: 52px; padding-top: 4px; color: #1e3a8a; }
    .sig-stamp { font-size: 8.5pt; color: #16a34a; margin-top: 4px; font-family: Arial, sans-serif; font-weight: bold; }
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
    <img src="/logoabed2.png" alt="Logo ABED" />
  </div>

  ${corpsHtml}

  <div class="footer">ABED ONG · Parakou, Bénin · Système de gestion RH</div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
