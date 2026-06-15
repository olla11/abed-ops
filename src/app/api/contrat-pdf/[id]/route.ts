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
  const sigLeft = isDE ? "Le Président du Conseil d'Administration" : "Le Directeur Exécutif"
  const sigRight = `${p?.civilite ?? ''} ${p?.prenoms ?? ''} ${p?.nom ?? ''}`
  const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'
  const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : 'Indéterminée'
  const today = new Date().toLocaleDateString('fr-FR')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat ${contrat.numero ?? ''} — ${p?.prenoms} ${p?.nom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #111; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .no-print { text-align: center; margin-bottom: 24px; }
    .no-print button { padding: 10px 24px; background: #16a34a; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
    h1 { text-align: center; font-size: 16pt; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 32px; }
    .ref { text-align: right; font-size: 10pt; color: #555; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
    .row { display: flex; gap: 16px; margin-bottom: 6px; }
    .label { font-weight: bold; min-width: 160px; }
    .value { flex: 1; }
    .sig-block { display: flex; justify-content: space-between; margin-top: 60px; }
    .sig { text-align: center; width: 45%; }
    .sig-line { border-top: 1px solid #000; margin-top: 48px; padding-top: 6px; font-size: 10pt; }
    .footer { text-align: center; font-size: 9pt; color: #888; margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { .no-print { display: none !important; } body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Imprimer / Télécharger en PDF</button>
  </div>

  <div class="ref">Réf. : ${contrat.numero ?? 'N/A'} &nbsp;|&nbsp; Date : ${today}</div>

  <h1>ABED ONG</h1>
  <div class="subtitle">Contrat de ${contrat.type_contrat}</div>

  <div class="section">
    <h2>Entre les parties</h2>
    <div class="row"><span class="label">L'Organisation :</span><span class="value">ABED ONG, représentée par son Directeur Exécutif, ci-après dénommée « l'Employeur »</span></div>
    <div class="row"><span class="label">L'Employé(e) :</span><span class="value">${p?.civilite ?? ''} ${p?.prenoms ?? ''} ${p?.nom ?? ''}, ci-après dénommé(e) « l'Employé(e) »</span></div>
  </div>

  <div class="section">
    <h2>Termes du contrat</h2>
    <div class="row"><span class="label">Type de contrat :</span><span class="value">${contrat.type_contrat}</span></div>
    <div class="row"><span class="label">Poste :</span><span class="value">${contrat.poste ?? '—'}</span></div>
    <div class="row"><span class="label">Direction :</span><span class="value">${contrat.direction ?? '—'}</span></div>
    <div class="row"><span class="label">Date de début :</span><span class="value">${dateDebut}</span></div>
    <div class="row"><span class="label">Date de fin :</span><span class="value">${dateFin}</span></div>
    ${contrat.salaire_brut ? `<div class="row"><span class="label">Salaire brut :</span><span class="value">${Number(contrat.salaire_brut).toLocaleString('fr-FR')} FCFA / mois</span></div>` : ''}
    ${contrat.observations ? `<div class="row"><span class="label">Observations :</span><span class="value">${contrat.observations}</span></div>` : ''}
  </div>

  <div class="sig-block">
    <div class="sig">
      <div class="sig-line">${sigLeft}</div>
    </div>
    <div class="sig">
      <div class="sig-line">${sigRight}</div>
    </div>
  </div>

  <div class="footer">ABED ONG · Parakou, Bénin</div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
