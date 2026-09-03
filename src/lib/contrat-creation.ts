// Moteur partagé de création d'un contrat + démarrage de son circuit de
// signature — utilisé par la création normale (POST /api/rh/contrats) ET par
// le renouvellement (POST /api/rh/contrats/[id]/renouveler), pour que les
// deux produisent exactement le même résultat (numéro, notifications,
// demande de signature) plutôt que le renouvellement insère un contrat "nu"
// que personne ne signe jamais.
import { sendEmail } from '@/lib/resend'
import { signContratExterneToken } from '@/lib/contrat-externe-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

export type NouveauContratParams = {
  profile_id: string | null
  destinataire_email: string | null
  type_contrat: string
  date_debut: string
  poste: string | null
  direction: string | null
  date_fin: string | null
  salaire_brut: number | null
  observations: string | null
  categorie_document: string
  contrat_parent_id: string | null
  // Renouvellement : pointe vers le contrat qu'on remplace (colonne déjà
  // présente en base, protégée par le trigger anti-falsification, jusqu'ici
  // jamais renseignée par l'ancienne route de renouvellement).
  renouvele_depuis: string | null
  objet: string | null
  articles: unknown[]
  commentaires_rh: string | null
  source_financement: string | null
  template_id: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function creerContratEtDemarrerCircuit(service: any, actorUserId: string, p: NouveauContratParams) {
  const categorie = p.categorie_document || 'Contrat'
  // Une offre — de stage ou non — passe toujours par le DE en premier,
  // avant d'aller chez le/la bénéficiaire (contrairement à un Contrat/
  // Convention classique, où l'employé signe en premier).
  const deSigneAvant = categorie === 'Offre de stage' || categorie === 'Offre'

  const { data: contrat, error: insertError } = await service.from('contrats').insert({
    profile_id: p.profile_id || null,
    destinataire_email: p.destinataire_email,
    type_contrat: p.type_contrat, date_debut: p.date_debut,
    poste: p.poste || null,
    direction: p.direction || null,
    date_fin: p.date_fin || null,
    salaire_brut: p.salaire_brut || null,
    observations: p.observations || null,
    source_financement: p.source_financement || null,
    categorie_document: categorie,
    contrat_parent_id: p.contrat_parent_id,
    renouvele_depuis: p.renouvele_depuis,
    objet: p.objet || null,
    articles: p.articles || [],
    commentaires_rh: p.commentaires_rh || null,
    template_id: p.template_id || null,
    statut: 'actif',
    workflow_statut: deSigneAvant ? 'envoye_de' : 'envoye_employe',
  }).select('*, profile:profiles!profile_id(id, nom, prenoms, email, role, civilite)').single()

  if (insertError) return { error: insertError.message, status: 500 } as const

  // Numéro : 001 /ABED-ONG/DE/DAF/CAF/2026
  const year = new Date().getFullYear()
  let numero: string

  const { data: seqData, error: seqError } = await service.rpc('nextval_contrats_seq')

  if (!seqError && seqData != null) {
    numero = `${String(Number(seqData)).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
  } else {
    const { count } = await service.from('contrats').select('id', { count: 'exact', head: true })
    numero = `${String(count ?? 1).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
  }

  const { error: numeroErr } = await service.from('contrats').update({ numero }).eq('id', contrat.id)
  if (numeroErr) console.error('[contrat-creation] échec écriture numero:', numeroErr)

  type ProfileRow = { id: string; nom: string; prenoms: string; email: string | null; role: string; civilite: string | null }
  const profile = contrat.profile as ProfileRow | null
  const emailDestinataire = p.destinataire_email

  // Signataire selon le rôle de l'employé — une Offre (de stage ou non) et
  // un destinataire externe passent toujours par le DE.
  let signataireProfile: { id: string; nom: string; prenoms: string; email?: string | null } | null = null
  if (profile || emailDestinataire) {
    const signatoryRole = (profile && !deSigneAvant && ['de', 'dp'].includes(profile.role)) ? 'administrateur' : 'de'
    const { data: signatories } = await service
      .from('profiles').select('id, nom, prenoms, email').eq('role', signatoryRole).limit(1)
    if (signatories && signatories.length > 0) {
      signataireProfile = signatories[0] as { id: string; nom: string; prenoms: string; email?: string | null }
    }
  }

  let demandeId: string | null = null
  if (signataireProfile && (profile || deSigneAvant)) {
    const nomPartie = profile ? `${profile.prenoms} ${profile.nom}` : (emailDestinataire ?? '')
    const titre = `${categorie} ${p.type_contrat} — ${nomPartie}`
    const { data: demande, error: demandeError } = await service.from('demandes_signature').insert({
      titre, description: `${categorie} ${numero}`, createur_id: actorUserId, statut: 'en_attente',
    }).select('id').single()

    if (!demandeError && demande) {
      demandeId = (demande as { id: string }).id
      await service.from('signataires').insert({ demande_id: demandeId, profile_id: signataireProfile.id, signe: false, ordre: 1 })
      await service.from('contrats').update({ demande_signature_id: demandeId }).eq('id', contrat.id)
    }
  }

  if (deSigneAvant) {
    const nomPartieAffiche = profile ? `${profile.prenoms} ${profile.nom}` : (emailDestinataire ?? '')
    if (signataireProfile) {
      const { error: notifDeErr } = await service.from('notifications').insert({
        user_id: signataireProfile.id,
        titre: `${categorie} à signer`,
        message: `${categorie} ${p.type_contrat} pour ${nomPartieAffiche} (réf. ${numero}) — à signer avant envoi au/à la bénéficiaire.`,
        lien: '/signatures',
      })
      if (notifDeErr) console.error('[contrat-creation] notif in-app DE:', notifDeErr)

      if (signataireProfile.email) {
        try {
          await sendEmail({
            to: signataireProfile.email,
            subject: `${categorie} à signer — ${nomPartieAffiche}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#16a34a;">ABED ONG — ${categorie} à signer</h2>
                <p>Bonjour ${signataireProfile.prenoms} ${signataireProfile.nom},</p>
                <p>Une nouvelle ${categorie.toLowerCase()} (${p.type_contrat}) a été établie pour <strong>${nomPartieAffiche}</strong> (réf. ${numero}) et attend votre signature avant envoi au/à la bénéficiaire.</p>
                <p>
                  <a href="${APP_URL}/signatures"
                     style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Accéder aux signatures
                  </a>
                </p>
                <p style="color:#6b7280;font-size:12px;">ABED ONG — Système de gestion RH</p>
              </div>
            `,
          })
        } catch (emailErr) {
          console.error('[contrat-creation] Email DE error:', emailErr)
        }
      }
    }
  } else if (emailDestinataire) {
    const now = new Date()
    const expireLe = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    await service.from('contrats').update({
      lien_externe_genere_le: now.toISOString(),
      lien_externe_expire_le: expireLe.toISOString(),
    }).eq('id', contrat.id)

    const lienToken = signContratExterneToken(contrat.id, emailDestinataire)
    const lienExterne = `${APP_URL}/contrats/externe?t=${lienToken}`
    try {
      await sendEmail({
        to: emailDestinataire,
        subject: `Votre ${categorie} ${p.type_contrat} — ABED ONG`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#16a34a;">ABED ONG — ${categorie}</h2>
            <p>Bonjour,</p>
            <p>Un nouveau ${categorie.toLowerCase()} a été établi à votre attention :</p>
            <ul>
              <li><strong>Référence :</strong> ${numero}</li>
              <li><strong>Catégorie :</strong> ${categorie}</li>
              <li><strong>Type :</strong> ${p.type_contrat}</li>
              ${p.poste ? `<li><strong>Poste :</strong> ${p.poste}</li>` : ''}
              <li><strong>Date de début :</strong> ${p.date_debut}</li>
              ${p.date_fin ? `<li><strong>Date de fin :</strong> ${p.date_fin}</li>` : ''}
            </ul>
            <p>Cliquez ci-dessous pour consulter le document, indiquer votre nom et le signer (ou le commenter). Aucun compte n'est nécessaire.</p>
            <p>
              <a href="${lienExterne}"
                 style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                Consulter le document →
              </a>
            </p>
            <p style="color:#6b7280;font-size:12px;">Ce lien est personnel et expire dans 72 heures. ABED ONG — Système de gestion RH</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[contrat-creation] Email destinataire externe error:', emailErr)
    }
  } else if (p.profile_id) {
    const { error: notifError } = await service.from('notifications').insert({
      user_id: p.profile_id,
      titre: `Nouveau ${categorie} établi à votre nom`,
      message: `${categorie} ${p.type_contrat} (réf. ${numero}) — Consultez et signez votre document sur My ABED.`,
      lien: '/mes-contrats',
    })
    if (notifError) console.error('[contrat-creation] notif in-app employé:', notifError)

    if (profile?.email) {
      const civilite = profile.civilite ?? ''
      try {
        await sendEmail({
          to: profile.email,
          subject: `Votre ${categorie} ${p.type_contrat} — ABED ONG`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#16a34a;">ABED ONG — ${categorie}</h2>
              <p>Bonjour ${civilite} ${profile.prenoms} ${profile.nom},</p>
              <p>Un nouveau ${categorie.toLowerCase()} a été établi à votre nom :</p>
              <ul>
                <li><strong>Référence :</strong> ${numero}</li>
                <li><strong>Catégorie :</strong> ${categorie}</li>
                <li><strong>Type :</strong> ${p.type_contrat}</li>
                <li><strong>Poste :</strong> ${p.poste ?? '—'}</li>
                <li><strong>Date de début :</strong> ${p.date_debut}</li>
                ${p.date_fin ? `<li><strong>Date de fin :</strong> ${p.date_fin}</li>` : ''}
              </ul>
              <p>Ce document requiert votre signature électronique. Vous pouvez aussi y ajouter des commentaires.</p>
              <p>
                <a href="${APP_URL}/signatures"
                   style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                  Accéder aux signatures
                </a>
              </p>
              <p style="color:#6b7280;font-size:12px;">ABED ONG — Système de gestion RH</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('[contrat-creation] Email error:', emailErr)
      }
    }
  }

  return { contrat: { ...contrat, numero, demande_signature_id: demandeId } } as const
}
