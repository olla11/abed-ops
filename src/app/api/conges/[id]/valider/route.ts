import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { sendEmail } from '@/lib/resend'
import { accordGenre } from '@/lib/genre'
import { estRH } from '@/lib/roles'
import { autoSkipConge } from '@/lib/circuit-vacancy'
import { finaliserCongeApprouve } from '@/lib/conge-notify'

type RouteContext = { params: Promise<{ id: string }> }

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

// Email d'étape intermédiaire (pas le ticket final, envoyé séparément par
// finaliserCongeApprouve une fois le statut 'approuve' atteint).
function emailCongeStatut(nom: string, statut: 'approuve_n1' | 'valide_rh' | 'rejete', conge: any, deCivilite: string | null | undefined, commentaire?: string) {
  const couleur = statut === 'rejete' ? '#dc2626' : '#16a34a'
  const icone = statut === 'rejete' ? '❌' : '⏳'
  const titre = statut === 'rejete' ? 'Demande de congé rejetée'
    : statut === 'approuve_n1' ? 'Congé approuvé par votre responsable — en attente RH/CAF'
    : 'Congé validé par les RH/CAF — en attente DE'
  const message = statut === 'rejete'
    ? `Votre demande de congé a été <strong style="color:#dc2626">rejetée</strong>.${commentaire ? `<br>Motif : ${commentaire}` : ''}`
    : statut === 'approuve_n1'
    ? `Votre responsable technique a approuvé votre demande. Elle est transmise aux RH/CAF pour validation.`
    : `Votre demande a été validée par les RH/CAF et est transmise ${accordGenre(deCivilite, 'au Directeur Exécutif', 'à la Directrice Exécutive')} pour autorisation finale.`

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <h2 style="color:${couleur};margin:0 0 20px">${icone} ${titre}</h2>
      <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Bonjour <strong>${nom}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151">${message}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280;width:40%">Période</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${conge.date_debut} → ${conge.date_fin}</td></tr>
          <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280">Durée</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${conge.nb_jours} jours ouvrables</td></tr>
        </table>
        <a href="${appUrl}/conges" style="display:block;text-align:center;background:${couleur};color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
          Voir mes congés →
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG</p>
    </div>
  `
}

function emailEtapeSuivante(titreDestinataire: string, destNom: string, nomEmploye: string, corps: string, couleur: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <h2 style="color:${couleur};margin:0 0 20px">⏳ ${titreDestinataire}</h2>
      <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Bonjour <strong>${destNom}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151">${corps}</p>
        <a href="${appUrl}/rh/conges" style="display:block;text-align:center;background:${couleur};color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
          Traiter →
        </a>
      </div>
    </div>
  `
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const myRole = me?.role ?? ''

  const body = await req.json()
  const { action, commentaire } = body

  if (!['approuver', 'rejeter'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Requêtes indépendantes — en parallèle plutôt qu'à la suite
  const [{ data: deProfile }, { data: conge }] = await Promise.all([
    service.from('profiles').select('civilite').eq('role', 'de').maybeSingle(),
    service.from('conges').select('*, profile:profiles!profile_id(id, nom, prenoms, email)').eq('id', id).single(),
  ])
  const deCivilite = deProfile?.civilite ?? 'M.'

  if (!conge) return NextResponse.json({ error: 'Congé introuvable' }, { status: 404 })

  const employe = conge.profile as any
  const nomEmploye = `${employe?.prenoms ?? ''} ${employe?.nom ?? ''}`.trim()

  // Circuit à 3 étapes distinctes — chacune a son propre acteur, aucune ne
  // se substitue à l'autre : responsable technique (N1) → RH ou CAF (estRH
  // couvre déjà les deux, la CAF hérite des pouvoirs RH partout ailleurs
  // dans l'app) → Direction Exécutive (DE, DP/Administrateur en secours).
  const estN1 = conge.valideur_n1_id === user.id
  const estRhCaf = estRH(myRole)
  const estAutoriteFinale = ['de', 'dp', 'administrateur'].includes(myRole)
  const estAdmin = ['admin', 'superadmin'].includes(myRole)

  let newStatut: string
  let notifUserId: string | null = null
  let notifTitre = ''
  let notifMessage = ''
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { commentaire_valideur: commentaire || null, updated_at: now }

  if (action === 'rejeter') {
    // Le rejet n'est permis qu'à l'étape en cours, par quelqu'un habilité à
    // CETTE étape précise — jamais sur un dossier déjà autorisé ou déjà
    // rejeté, et jamais par n'importe quel rôle passant une autre porte.
    const peutRejeterIci =
      (conge.statut === 'en_attente' && (estN1 || estAdmin)) ||
      (conge.statut === 'approuve_n1' && (estRhCaf || estAdmin)) ||
      (conge.statut === 'valide_rh' && (estAutoriteFinale || estAdmin))
    if (!peutRejeterIci) {
      return NextResponse.json({ error: 'Action non autorisée à cette étape' }, { status: 403 })
    }
    newStatut = 'rejete'
    notifUserId = conge.profile_id
    notifTitre = 'Demande de congé rejetée'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}) a été rejetée.${commentaire ? ` Motif : ${commentaire}` : ''}`
  } else if (conge.statut === 'en_attente' && (estN1 || estAdmin)) {
    newStatut = 'approuve_n1'
    updates.valideur_n1_le = now
    // Notifs/emails à la RH et au CAF — après la réponse, en parallèle.
    after(async () => {
      const { data: dests } = await service.from('profiles').select('id, email, prenoms, nom').in('role', ['rh', 'caf'])
      await Promise.allSettled((dests ?? []).map(async d => {
        await service.from('notifications').insert({
          user_id: d.id,
          titre: 'Congé — validation RH/CAF requise',
          message: `La demande de congé de ${nomEmploye} (${conge.nb_jours}j) a été approuvée par son responsable technique. Votre validation est requise.`,
          lien: '/rh/conges',
        })
        if (d.email) {
          await sendEmail({
            to: d.email,
            subject: `Congé ${nomEmploye} — validation RH/CAF requise`,
            html: emailEtapeSuivante('Validation RH/CAF requise', `${d.prenoms} ${d.nom}`,
              nomEmploye, `La demande de congé de <strong>${nomEmploye}</strong> a été approuvée par son responsable technique. Votre validation est requise.`, '#1e40af'),
          }).catch(() => {})
        }
      }))
    })
    notifUserId = conge.profile_id
    notifTitre = 'Congé approuvé par votre responsable'
    notifMessage = `Votre demande de congé a été approuvée par votre responsable technique. En attente de validation RH/CAF.`
  } else if (conge.statut === 'approuve_n1' && (estRhCaf || estAdmin)) {
    newStatut = 'valide_rh'
    updates.valideur_rh_id = user.id
    updates.valideur_rh_le = now
    // Notifs/emails à la DE/DP/administrateur — après la réponse, en parallèle.
    after(async () => {
      const { data: dests } = await service.from('profiles').select('id, email, prenoms, nom').in('role', ['de', 'dp', 'administrateur'])
      await Promise.allSettled((dests ?? []).map(async d => {
        await service.from('notifications').insert({
          user_id: d.id,
          titre: 'Congé — autorisation finale requise',
          message: `La demande de congé de ${nomEmploye} (${conge.nb_jours}j) a été validée par les RH/CAF. Autorisation finale requise.`,
          lien: '/rh/conges',
        })
        if (d.email) {
          await sendEmail({
            to: d.email,
            subject: `Congé ${nomEmploye} — autorisation finale requise`,
            html: emailEtapeSuivante('Autorisation finale requise', `${d.prenoms} ${d.nom}`,
              nomEmploye, `La demande de congé de <strong>${nomEmploye}</strong> a été validée par les RH/CAF. Votre autorisation finale est requise.`, '#1e40af'),
          }).catch(() => {})
        }
      }))
    })
    notifUserId = conge.profile_id
    notifTitre = 'Congé validé (RH/CAF)'
    notifMessage = `Votre demande de congé a été validée par les RH/CAF. En attente d'autorisation ${accordGenre(deCivilite, 'du Directeur Exécutif', 'de la Directrice Exécutive')}.`
  } else if (conge.statut === 'valide_rh' && (estAutoriteFinale || estAdmin)) {
    newStatut = 'approuve'
    updates.valideur_final_id = user.id
    updates.valideur_final_le = now
    notifUserId = conge.profile_id
    notifTitre = 'Congé approuvé'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}, ${conge.nb_jours} jours) a été approuvée.`
  } else {
    return NextResponse.json({ error: 'Action non autorisée à cette étape' }, { status: 403 })
  }

  updates.statut = newStatut

  const { data: updated, error } = await service.from('conges').update(updates).eq('id', id).select('*, type_conge:types_conge(nom)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('conges')

  // Si le nouveau statut attend un rôle qui n'a plus personne d'actif, fait
  // sauter automatiquement l'étape suivante plutôt que de bloquer le congé.
  await autoSkipConge(service, id).catch(e => console.error('[autoSkipConge]:', e))

  // Notification + email à l'employé — après la réponse, en parallèle.
  // Le ticket de congé final est envoyé séparément par finaliserCongeApprouve
  // (qui gère aussi la mise à jour du solde), pas ici.
  after(async () => {
    const tasks: PromiseLike<unknown>[] = []
    if (notifUserId && notifTitre) {
      tasks.push(service.from('notifications').insert({ user_id: notifUserId, titre: notifTitre, message: notifMessage, lien: '/conges' }))
    }
    if (employe?.email && newStatut !== 'approuve') {
      tasks.push(sendEmail({
        to: employe.email,
        subject: newStatut === 'approuve_n1' ? 'Congé approuvé par votre responsable — en attente RH/CAF'
          : newStatut === 'valide_rh' ? 'Congé validé (RH/CAF) — en attente DE'
          : 'Demande de congé rejetée',
        html: emailCongeStatut(nomEmploye, newStatut as any, conge, deCivilite, commentaire),
      }).catch(() => {}))
    }
    if (newStatut === 'approuve') {
      tasks.push(finaliserCongeApprouve(service, id))
    }
    await Promise.allSettled(tasks)
  })

  return NextResponse.json({ conge: updated })
}
