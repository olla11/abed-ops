import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'

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
    ['rh', 'admin', 'de', 'dp'].includes(me?.role ?? '')

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
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email)')
    .eq('id', id)
    .single()

  if (!ev) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data: me } = await service.from('profiles').select('role').eq('id', user.id).single()
  const myRole = me?.role ?? ''

  const body = await req.json()
  const { soumettre, ...fields } = body

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

  if (soumettre) {
    if (ev.statut === 'en_attente' && (ev.evaluateur_id === user.id || ['rh', 'admin'].includes(myRole))) {
      newStatut = 'evaluateur_complete'
      notifUserId = ev.profile_id
      notifTitre = 'Évaluation à commenter'
      notifMessage = `Votre évaluateur a complété votre fiche d'évaluation. Veuillez y ajouter vos commentaires.`
    } else if (ev.statut === 'evaluateur_complete' && ev.profile_id === user.id) {
      newStatut = 'evalue_complete'
      // Notifier le responsable/RH
      notifUserId = ev.evaluateur_id
      notifTitre = 'Évaluation — commentaires de l\'évalué(e)'
      notifMessage = `${nomEmploye} a ajouté ses commentaires sur sa fiche d'évaluation.`
    } else if (ev.statut === 'evalue_complete' && (ev.evaluateur_id === user.id || ['rh', 'admin', 'de', 'dp'].includes(myRole))) {
      newStatut = 'responsable_complete'
      // Notifier RH/admin
      notifTitre = 'Évaluation — avis responsable complété'
      notifMessage = `Le responsable a émis son avis sur l'évaluation de ${nomEmploye}. Décision requise.`
    } else if (ev.statut === 'responsable_complete' && ['rh', 'admin', 'de', 'dp'].includes(myRole)) {
      newStatut = 'cloture'
      notifUserId = ev.profile_id
      notifTitre = 'Évaluation clôturée'
      notifMessage = `Votre évaluation de fin de contrat a été clôturée.`
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
      const { data: evaluateur } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.evaluateur_id).single()
      if (evaluateur?.email) {
        await sendEmail({
          to: evaluateur.email,
          subject: `${nomEmploye} a commenté son évaluation`,
          html: emailBlock(`${evaluateur.prenoms} ${evaluateur.nom}`,
            "Commentaires de l'évalué(e)",
            `<strong>${nomEmploye}</strong> a ajouté ses commentaires sur sa fiche d'évaluation. Votre avis de responsable est maintenant requis.`),
        }).catch(() => {})
      }
    } else if (newStatut === 'responsable_complete') {
      const { data: rhUsers } = await service.from('profiles').select('email, prenoms, nom').in('role', ['rh', 'admin'])
      for (const rh of rhUsers ?? []) {
        if (rh.email) {
          await sendEmail({
            to: rh.email,
            subject: `Évaluation ${nomEmploye} — décision finale requise`,
            html: emailBlock(`${rh.prenoms} ${rh.nom}`,
              'Décision finale requise',
              `L'évaluation de <strong>${nomEmploye}</strong> a été complétée par toutes les parties. Votre décision finale (RH/DE) est requise pour clôturer le dossier.`),
          }).catch(() => {})
        }
      }
    } else if (newStatut === 'cloture') {
      const { data: employe } = await service.from('profiles').select('email, prenoms, nom').eq('id', ev.profile_id).single()
      if (employe?.email) {
        await sendEmail({
          to: employe.email,
          subject: "Votre évaluation de fin de contrat est clôturée",
          html: emailBlock(`${employe.prenoms} ${employe.nom}`,
            'Évaluation clôturée',
            `Votre évaluation de fin de contrat a été finalisée et clôturée par les RH. Vous pouvez consulter le résumé complet sur My ABED.`),
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ evaluation: updated })
}
