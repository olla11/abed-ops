import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererEvaluationPdf, nomFichierEvaluationPdf, type EvaluationPdfData } from '@/lib/evaluation-pdf'
import { estRH } from '@/lib/roles'
import { getTitulaireOfficiel } from '@/lib/titre-principal'

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

  // CAF et DE sont des rôles à titre unique côté institution : même si
  // plusieurs comptes peuvent techniquement porter le rôle "caf", le système
  // a un titulaire officiel désigné (titres_principaux) — on l'utilise
  // plutôt que de deviner via qui a cliqué (rendu_par), pas fiable si un
  // second compte CAF ou un admin a rendu la décision à sa place. Même
  // logique pour l'évaluateur, assigné d'avance sur le dossier (evaluateur_id).
  const nomEvaluateur = ev.evaluateur ? `${(ev.evaluateur as any).prenoms} ${(ev.evaluateur as any).nom}` : (ev.nom_evaluateur ?? '—')
  const [titulaireCaf, titulaireDE] = await Promise.all([
    getTitulaireOfficiel(admin, 'caf'),
    getTitulaireOfficiel(admin, 'de'),
  ])
  let nomCafDecideur: string | null = null
  if (titulaireCaf) {
    const { data: profilCaf } = await admin.from('profiles').select('nom, prenoms').eq('id', titulaireCaf.id).single()
    nomCafDecideur = profilCaf ? `${profilCaf.prenoms} ${profilCaf.nom}`.trim() : null
  }
  let nomDE: string | null = null
  if (titulaireDE) {
    const { data: profilDE } = await admin.from('profiles').select('nom, prenoms').eq('id', titulaireDE.id).single()
    nomDE = profilDE ? `${profilDE.prenoms} ${profilDE.nom}`.trim() : null
  }

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
