import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererEvaluationPdf, nomFichierEvaluationPdf, type EvaluationPdfData } from '@/lib/evaluation-pdf'
import { estRH } from '@/lib/roles'

// Rendu via Chromium headless, même moteur que les contrats — cf.
// src/app/api/contrat-pdf/[id]/route.ts. Le rapport final n'est
// téléchargeable qu'une fois le dossier clôturé (3 décisions rendues).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ev, error } = await admin
    .from('evaluations')
    .select(`
      *,
      profile:profiles!profile_id(id, nom, prenoms, civilite, role),
      evaluateur:profiles!evaluateur_id(id, nom, prenoms),
      responsable:profiles!responsable_id(id, nom, prenoms),
      contrat:contrats(id, type_contrat, date_debut, date_fin, poste)
    `)
    .eq('id', id)
    .single()

  if (error || !ev) return NextResponse.json({ error: 'Évaluation introuvable' }, { status: 404 })

  const me = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = me.data?.role ?? ''
  const canView =
    estRH(role) || ['admin', 'superadmin', 'de', 'dp', 'administrateur', 'aaf', 'caf'].includes(role) ||
    ev.profile_id === user.id || ev.evaluateur_id === user.id || ev.responsable_id === user.id
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  if (ev.statut !== 'cloture') {
    return NextResponse.json({ error: 'Le rapport final n\'est disponible qu\'une fois le dossier clôturé.' }, { status: 409 })
  }

  const p = ev.profile as any
  const c = ev.contrat as any
  const dateEtablissement = ev.declenchee_le
    ? new Date(ev.declenchee_le).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')

  // Le CAF n'est pas une personne assignée d'avance — n'importe quel profil
  // ayant ce rôle (il peut y en avoir plusieurs) peut rendre la décision,
  // donc son nom vient de qui a réellement décidé (rendu_par). La DE est un
  // poste unique (une seule personne peut jamais le porter) : son nom est
  // directement connu par son rôle, sans dépendre de qui a cliqué — utile
  // aussi si l'admin a rendu la décision à sa place. Même logique pour
  // l'évaluateur, assigné d'avance sur le dossier (evaluateur_id).
  const nomEvaluateur = ev.evaluateur ? `${(ev.evaluateur as any).prenoms} ${(ev.evaluateur as any).nom}` : (ev.nom_evaluateur ?? '—')
  let nomCafDecideur: string | null = null
  if ((ev.decision_caf as any)?.rendu_par) {
    const { data: decideurCaf } = await admin.from('profiles').select('nom, prenoms').eq('id', (ev.decision_caf as any).rendu_par).single()
    nomCafDecideur = decideurCaf ? `${decideurCaf.prenoms} ${decideurCaf.nom}`.trim() : null
  }
  const { data: profilDE } = await admin.from('profiles').select('nom, prenoms').eq('role', 'de').single()
  const nomDE = profilDE ? `${profilDE.prenoms} ${profilDE.nom}`.trim() : null

  const pdfData: EvaluationPdfData = {
    employeCivilite: p?.civilite ?? null,
    employePrenoms: p?.prenoms ?? '',
    employeNom: p?.nom ?? '',
    poste: ev.poste ?? c?.poste ?? null,
    direction: ev.direction ?? null,
    contratTypeContrat: c?.type_contrat ?? null,
    contratDateDebut: c?.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : null,
    contratDateFin: c?.date_fin ? new Date(c.date_fin).toLocaleDateString('fr-FR') : null,
    supHier: ev.superieur_hierarchique ?? null,
    supFonc: ev.superieur_fonctionnel ?? null,
    nomResponsable: ev.responsable ? `${(ev.responsable as any).prenoms} ${(ev.responsable as any).nom}` : (ev.responsable_departement ?? '—'),
    nomEvaluateur,
    descriptionTaches: ev.description_taches ?? null,
    grilleNotes: ev.grille_notes ?? {},
    scoreMoyen: ev.score_moyen ?? null,
    qualites: ev.qualites ?? null,
    pointsAmelioration: ev.points_amelioration ?? null,
    actionsExceptionnelles: ev.actions_exceptionnelles ?? null,
    evaluationGenerale: ev.evaluation_generale ?? null,
    commentaireEvaluateur: ev.commentaire_evaluateur ?? null,
    sigEvaluateur: ev.signature_evaluateur ?? null,
    dateEvaluateur: ev.date_evaluateur ?? null,
    commentaireEvalue: ev.commentaire_evalue ?? null,
    sigEvalue: ev.signature_evalue ?? null,
    dateEvalue: ev.date_evalue ?? null,
    avisResponsable: ev.avis_responsable ?? null,
    commentaireResponsable: ev.commentaire_responsable ?? null,
    sigResponsable: ev.signature_responsable ?? null,
    dateResponsable: ev.date_responsable ?? null,
    decisionEvaluateur: (ev.decision_evaluateur as any)?.decision ?? null,
    decisionEvaluateurNom: nomEvaluateur ?? null,
    decisionEvaluateurDate: (ev.decision_evaluateur as any)?.rendu_le ?? null,
    decisionCaf: (ev.decision_caf as any)?.decision ?? null,
    decisionCafNom: nomCafDecideur,
    decisionCafDate: (ev.decision_caf as any)?.rendu_le ?? null,
    decisionDe: (ev.decision_de as any)?.decision ?? null,
    decisionDeNom: nomDE,
    decisionDeDate: (ev.decision_de as any)?.rendu_le ?? null,
    dateEtablissement,
  }

  const pdfBuffer = await genererEvaluationPdf(pdfData)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierEvaluationPdf(pdfData.employePrenoms, pdfData.employeNom, id)}"`,
    },
  })
}
