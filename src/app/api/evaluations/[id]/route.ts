import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { estRH } from '@/lib/roles'
import { genererEvaluationPdf, nomFichierEvaluationPdf, type EvaluationPdfData } from '@/lib/evaluation-pdf'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function calcScoreMoyen(notes: Record<string, number>): number | null {
  const vals = Object.values(notes).filter(v => typeof v === 'number' && v > 0)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ev, error } = await service
    .from('evaluations')
    .select(`
      *,
      profile:profiles!profile_id(id, nom, prenoms, email, role),
      evaluateur:profiles!evaluateur_id(id, nom, prenoms, email),
      responsable:profiles!responsable_id(id, nom, prenoms, email),
      contrat:contrats(id, type_contrat, date_debut, date_fin, poste, statut)
    `)
    .eq('id', id)
    .single()

  if (error || !ev) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Vérifier accès
  const { data: me } = await service.from('profiles').select('role').eq('id', user.id).single()
  const canAccess =
    ev.profile_id === user.id ||
    ev.evaluateur_id === user.id ||
    ev.responsable_id === user.id ||
    estRH(me?.role) || ['admin', 'superadmin', 'de', 'dp'].includes(me?.role ?? '')

  if (!canAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  return NextResponse.json({ evaluation: ev, myRole: me?.role, myId: user.id })
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ev } = await service
    .from('evaluations')
    .select(`
      *,
      profile:profiles!profile_id(id, nom, prenoms, email, civilite),
      evaluateur:profiles!evaluateur_id(id, nom, prenoms),
      responsable:profiles!responsable_id(id, nom, prenoms),
      contrat:contrats(type_contrat, date_debut, date_fin, poste)
    `)
    .eq('id', id)
    .single()

  if (!ev) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data: me } = await service.from('profiles').select('role').eq('id', user.id).single()
  const myRole = me?.role ?? ''

  const body = await req.json()
  const { soumettre, ...fields } = body

  // Section X : la CAF ne peut rendre sa décision qu'une fois celle de
  // l'évaluateur enregistrée, la DE qu'une fois celle de la CAF enregistrée
  // — même règle que côté client (EvaluationForm.tsx), revalidée ici pour
  // ne pas dépendre uniquement du verrouillage de l'UI. Admin/superadmin
  // passent outre, comme partout ailleurs dans ce circuit.
  const isAdminRole = ['admin', 'superadmin'].includes(myRole)
  const aUneDecision = (obj: unknown) => !!(obj && typeof obj === 'object' && (obj as Record<string, unknown>).decision)
  if ('decision_caf' in fields && !isAdminRole && !aUneDecision(ev.decision_evaluateur)) {
    return NextResponse.json({ error: "La décision de l'évaluateur doit être rendue avant celle de la CAF." }, { status: 400 })
  }
  if ('decision_de' in fields && !isAdminRole && !aUneDecision(fields.decision_caf ?? ev.decision_caf)) {
    return NextResponse.json({ error: 'La décision de la CAF doit être rendue avant celle de la Direction Exécutive.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }

  // Calculer score moyen si grille_notes fourni
  if (fields.grille_notes) {
    const score = calcScoreMoyen(fields.grille_notes)
    if (score !== null) updates.score_moyen = score
  }

  // Déterminer le nouveau statut selon le workflow
  let newStatut: string | null = null
  let notifUserId: string | null = null
  let notifTitre = ''
  let notifMessage = ''
  let notifLien = `/evaluations/${id}`
  const nomEmploye = `${(ev.profile as any)?.prenoms ?? ''} ${(ev.profile as any)?.nom ?? ''}`.trim()

  // Section X (décisions finales) implique trois personnes distinctes —
  // évaluateur, CAF, Direction Exécutive — la clôture n'est autorisée que
  // lorsque les trois ont effectivement rendu leur décision.
  const decisionsCompletes = (obj: unknown) => !!(obj && typeof obj === 'object' && (obj as Record<string, unknown>).decision)
  const decEvalFinal = (fields.decision_evaluateur ?? ev.decision_evaluateur) as unknown
  const decCafFinal = (fields.decision_caf ?? ev.decision_caf) as unknown
  const decDeFinal = (fields.decision_de ?? ev.decision_de) as unknown
  const troisDecisionsPresentes = decisionsCompletes(decEvalFinal) && decisionsCompletes(decCafFinal) && decisionsCompletes(decDeFinal)

  let notifsMultiples: { userId: string; titre: string; message: string }[] = []

  if (soumettre) {
    if (ev.statut === 'en_attente' && (ev.evaluateur_id === user.id || isAdminRole)) {
      newStatut = 'evaluateur_complete'
      notifUserId = ev.profile_id
      notifTitre = 'Évaluation à commenter'
      notifMessage = `Votre évaluateur a complété votre fiche d'évaluation. Veuillez y ajouter vos commentaires.`
    } else if (ev.statut === 'evaluateur_complete' && ev.profile_id === user.id) {
      newStatut = 'evalue_complete'
      // Notifier le responsable de département désigné à l'ouverture de l'évaluation
      notifUserId = ev.responsable_id
      notifTitre = 'Évaluation — commentaires de l\'évalué(e)'
      notifMessage = `${nomEmploye} a ajouté ses commentaires sur sa fiche d'évaluation. Votre avis de responsable est requis.`
    } else if (ev.statut === 'evalue_complete' && (ev.responsable_id === user.id || isAdminRole)) {
      newStatut = 'responsable_complete'
      // Décision requise de trois personnes distinctes : l'évaluateur, la CAF, la Direction Exécutive
      const { data: decideurs } = await service.from('profiles').select('id, email, prenoms, nom, role').in('role', ['caf', 'de', 'dp'])
      const cible = new Set<string>()
      if (ev.evaluateur_id) cible.add(ev.evaluateur_id)
      for (const d of decideurs ?? []) cible.add(d.id)
      for (const uid of cible) {
        notifsMultiples.push({
          userId: uid,
          titre: 'Évaluation — décision requise',
          message: `Le responsable a émis son avis sur l'évaluation de ${nomEmploye}. Votre décision (renouvellement, durée...) est requise en Section X.`,
        })
      }
    } else if (ev.statut === 'responsable_complete' && (isAdminRole || estRH(myRole) || ['de', 'dp'].includes(myRole))) {
      if (!troisDecisionsPresentes) {
        return NextResponse.json({ error: "Les trois décisions (évaluateur, CAF, Direction Exécutive) doivent être renseignées avant de clôturer." }, { status: 400 })
      }
      newStatut = 'cloture'
      notifUserId = ev.profile_id
      notifTitre = 'Évaluation clôturée'
      notifMessage = `Votre évaluation de fin de contrat a été clôturée. Le rapport PDF est disponible sur votre fiche.`

      // La RH doit aussi être notifiée à la clôture — c'est elle qui garde la
      // trace du dossier final et le télécharge depuis son interface.
      const { data: rhProfiles } = await service.from('profiles').select('id').in('role', ['rh', 'caf', 'admin', 'superadmin'])
      for (const rhP of rhProfiles ?? []) {
        notifsMultiples.push({
          userId: rhP.id,
          titre: 'Évaluation clôturée',
          message: `L'évaluation de fin de contrat de ${nomEmploye} est clôturée. Le rapport PDF est disponible dans Documents RH.`,
        })
      }
    }

    if (newStatut) updates.statut = newStatut
  }

  const { data: updated, error } = await service
    .from('evaluations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification in-app
  if (notifUserId && notifTitre) {
    await service.from('notifications').insert({
      user_id: notifUserId,
      titre: notifTitre,
      message: notifMessage,
      lien: notifLien,
    })
  }
  for (const n of notifsMultiples) {
    await service.from('notifications').insert({ user_id: n.userId, titre: n.titre, message: n.message, lien: notifLien })
  }

  // Emails selon la transition
  if (newStatut && soumettre) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
    const lien = `${appUrl}/evaluations/${id}`

    const emailBlock = (dest: string, titre: string, corps: string) => `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
        <h2 style="color:#16a34a;margin:0 0 20px">📝 ${titre}</h2>
        <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
          <p style="margin:0 0 16px;font-size:14px;color:#374151">Bonjour <strong>${dest}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">${corps}</p>
          <a href="${lien}" style="display:block;text-align:center;background:#16a34a;color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
            Accéder à l'évaluation →
          </a>
        </div>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG</p>
      </div>
    `

    if (newStatut === 'evaluateur_complete') {
      const { data: employe } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.profile_id).single()
      if (employe?.email) {
        await sendEmail({
          to: employe.email,
          subject: "Votre fiche d'évaluation est disponible",
          html: emailBlock(`${employe.prenoms} ${employe.nom}`,
            "Évaluation à compléter",
            "Votre évaluateur a renseigné votre fiche d'évaluation de fin de contrat. Connectez-vous pour ajouter vos commentaires et observations."),
        }).catch(() => {})
      }
    } else if (newStatut === 'evalue_complete') {
      const { data: responsable } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.responsable_id).single()
      if (responsable?.email) {
        await sendEmail({
          to: responsable.email,
          subject: `${nomEmploye} a commenté son évaluation`,
          html: emailBlock(`${responsable.prenoms} ${responsable.nom}`,
            "Commentaires de l'évalué(e)",
            `<strong>${nomEmploye}</strong> a ajouté ses commentaires sur sa fiche d'évaluation. Votre avis de responsable est maintenant requis.`),
        }).catch(() => {})
      }
    } else if (newStatut === 'responsable_complete') {
      // Décision requise de trois personnes distinctes : évaluateur, CAF, Direction Exécutive
      const { data: decideurs } = await service.from('profiles').select('id, email, prenoms, nom, role').in('role', ['caf', 'de', 'dp'])
      const destinataires = new Map<string, { email: string; prenoms: string; nom: string }>()
      for (const d of decideurs ?? []) {
        if (d.email) destinataires.set(d.id, { email: d.email, prenoms: d.prenoms, nom: d.nom })
      }
      if (ev.evaluateur_id && !destinataires.has(ev.evaluateur_id)) {
        const { data: evaluateur } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.evaluateur_id).single()
        if (evaluateur?.email) destinataires.set(ev.evaluateur_id, evaluateur)
      }
      for (const dest of destinataires.values()) {
        await sendEmail({
          to: dest.email,
          subject: `Évaluation ${nomEmploye} — décision requise`,
          html: emailBlock(`${dest.prenoms} ${dest.nom}`,
            'Décision requise',
            `L'évaluation de <strong>${nomEmploye}</strong> a été complétée par l'évaluateur, l'évalué(e) et le responsable. Votre décision (Section X) est requise pour permettre la clôture du dossier.`),
        }).catch(() => {})
      }
    } else if (newStatut === 'cloture') {
      const { data: employe } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.profile_id).single()
      if (employe?.email) {
        // Le rapport final est joint directement à l'email de l'évalué(e) —
        // elle n'a pas systématiquement le réflexe de revenir sur My ABED.
        let attachments: { filename: string; content: string }[] | undefined
        try {
          const p = ev.profile as any
          const c = ev.contrat as any
          const pdfData: EvaluationPdfData = {
            employeCivilite: p?.civilite ?? null,
            employePrenoms: p?.prenoms ?? '',
            employeNom: p?.nom ?? '',
            poste: updated.poste ?? c?.poste ?? null,
            direction: updated.direction ?? null,
            contratTypeContrat: c?.type_contrat ?? null,
            contratDateDebut: c?.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : null,
            contratDateFin: c?.date_fin ? new Date(c.date_fin).toLocaleDateString('fr-FR') : null,
            supHier: updated.superieur_hierarchique ?? null,
            supFonc: updated.superieur_fonctionnel ?? null,
            nomResponsable: ev.responsable ? `${(ev.responsable as any).prenoms} ${(ev.responsable as any).nom}` : (updated.responsable_departement ?? '—'),
            nomEvaluateur: ev.evaluateur ? `${(ev.evaluateur as any).prenoms} ${(ev.evaluateur as any).nom}` : (updated.nom_evaluateur ?? '—'),
            descriptionTaches: updated.description_taches ?? null,
            grilleNotes: updated.grille_notes ?? {},
            scoreMoyen: updated.score_moyen ?? null,
            qualites: updated.qualites ?? null,
            pointsAmelioration: updated.points_amelioration ?? null,
            actionsExceptionnelles: updated.actions_exceptionnelles ?? null,
            evaluationGenerale: updated.evaluation_generale ?? null,
            commentaireEvaluateur: updated.commentaire_evaluateur ?? null,
            sigEvaluateur: updated.signature_evaluateur ?? null,
            dateEvaluateur: updated.date_evaluateur ?? null,
            commentaireEvalue: updated.commentaire_evalue ?? null,
            sigEvalue: updated.signature_evalue ?? null,
            dateEvalue: updated.date_evalue ?? null,
            avisResponsable: updated.avis_responsable ?? null,
            commentaireResponsable: updated.commentaire_responsable ?? null,
            sigResponsable: updated.signature_responsable ?? null,
            dateResponsable: updated.date_responsable ?? null,
            decisionEvaluateur: (updated.decision_evaluateur as any)?.decision ?? null,
            decisionCaf: (updated.decision_caf as any)?.decision ?? null,
            decisionDe: (updated.decision_de as any)?.decision ?? null,
            dateEtablissement: updated.declenchee_le ? new Date(updated.declenchee_le).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
          }
          const pdfBuffer = await genererEvaluationPdf(pdfData)
          attachments = [{ filename: nomFichierEvaluationPdf(pdfData.employePrenoms, pdfData.employeNom, id), content: pdfBuffer.toString('base64') }]
        } catch (e) {
          console.error('[evaluations] échec génération PDF pour email de clôture:', e)
        }

        await sendEmail({
          to: employe.email,
          subject: "Votre évaluation de fin de contrat est clôturée",
          html: emailBlock(`${employe.prenoms} ${employe.nom}`,
            'Évaluation clôturée',
            `Votre évaluation de fin de contrat a été finalisée et clôturée par les RH. Le rapport complet est joint à cet email, et reste disponible sur My ABED.`),
          attachments,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ evaluation: updated })
}
