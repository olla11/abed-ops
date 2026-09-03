import { sendEmail } from '@/lib/resend'
import { createAdminClient } from '@/lib/supabase-server'
import { signExternalSignerToken } from '@/lib/external-signer-token'
import { signContratExterneToken } from '@/lib/contrat-externe-token'
import { composeSignedPdf } from '@/lib/pdf-signature'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

type AdminClient = ReturnType<typeof createAdminClient>

type SignataireOrdreRow = {
  id: string
  ordre: number | null
  signe: boolean
  est_observateur: boolean
  profile_id: string | null
  nom_externe: string | null
  profile: { nom: string; prenoms: string } | { nom: string; prenoms: string }[] | null
}

function nomAffiche(row: SignataireOrdreRow): string {
  const p = Array.isArray(row.profile) ? row.profile[0] : row.profile
  return p ? `${p.prenoms} ${p.nom}` : (row.nom_externe ?? 'un autre signataire')
}

/**
 * Vérifie que c'est bien le tour de ce signataire (signature dans l'ordre
 * choisi à la création). Renvoie ok=true si aucun signataire d'un palier
 * antérieur (ordre plus petit, non signé) n'est en attente.
 */
export async function verifierTour(
  admin: AdminClient,
  demandeId: string,
  monOrdre: number | null
): Promise<{ ok: true } | { ok: false; enAttenteDe: string }> {
  const { data: rows } = await admin
    .from('signataires')
    .select('id, ordre, signe, est_observateur, profile_id, nom_externe, profile:profiles!signataires_profile_id_fkey(nom, prenoms)')
    .eq('demande_id', demandeId)

  const nonSignes = ((rows ?? []) as SignataireOrdreRow[]).filter(r => !r.est_observateur && !r.signe)
  if (nonSignes.length === 0) return { ok: true }

  const minOrdre = Math.min(...nonSignes.map(r => r.ordre ?? 0))
  if ((monOrdre ?? 0) === minOrdre) return { ok: true }

  const enAttenteDe = nonSignes.filter(r => (r.ordre ?? 0) === minOrdre).map(nomAffiche).join(', ')
  return { ok: false, enAttenteDe }
}

/**
 * Signature dans l'ordre choisi : une fois un palier entièrement signé,
 * notifie (in-app + email) le palier suivant — jamais avant, jamais deux
 * fois (voir la colonne `notifie`).
 */
export async function notifyNextStepIfReady(
  admin: AdminClient,
  demandeId: string,
  demande: { titre: string; description?: string | null }
) {
  const { data: rows } = await admin
    .from('signataires')
    .select('id, ordre, signe, est_observateur, notifie, profile_id, email, nom_externe, profile:profiles!signataires_profile_id_fkey(nom, prenoms, email)')
    .eq('demande_id', demandeId)

  const nonSignes = ((rows ?? []) as (SignataireOrdreRow & { notifie: boolean; email: string | null })[])
    .filter(r => !r.est_observateur && !r.signe)
  if (nonSignes.length === 0) return

  const minOrdre = Math.min(...nonSignes.map(r => r.ordre ?? 0))
  const aNotifier = nonSignes.filter(r => (r.ordre ?? 0) === minOrdre && !r.notifie)
  if (aNotifier.length === 0) return

  await admin.from('signataires').update({ notifie: true }).in('id', aNotifier.map(r => r.id))

  for (const r of aNotifier) {
    if (r.profile_id) {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
      await admin.from('notifications').insert({
        user_id: r.profile_id,
        titre: 'Document à signer',
        message: `C'est votre tour de signer « ${demande.titre} »`,
        lien: `/signatures/${demandeId}/signer`,
      }).then(({ error: e }: { error: unknown }) => { if (e) console.error('[Signatures] Notif étape suivante error:', e) })

      const email = (p as { email?: string } | undefined)?.email
      if (email) {
        await sendEmail({
          to: email,
          subject: `My ABED — Document à signer : ${demande.titre}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#16a34a;">My ABED — C'est votre tour de signer</h2>
              <p>Bonjour <strong>${p ? `${(p as { prenoms: string }).prenoms} ${(p as { nom: string }).nom}` : ''}</strong>,</p>
              <p>Les signataires précédents ont terminé — c'est maintenant votre tour de signer :</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;font-size:16px;font-weight:700;">${demande.titre}</p>
                ${demande.description ? `<p style="margin:8px 0 0;color:#6b7280;">${demande.description}</p>` : ''}
              </div>
              <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                Voir le document
              </a>
              <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
            </div>
          `,
        }).catch((err: unknown) => console.error(`[Signatures] Email étape suivante error (${email}):`, err))
      }
    } else if (r.email) {
      const token = signExternalSignerToken(r.id, r.email)
      const lienSignature = `${APP_URL}/signatures/externe?t=${token}`
      await sendEmail({
        to: r.email,
        subject: `My ABED — Document à signer : ${demande.titre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">My ABED — C'est votre tour de signer</h2>
            <p>Bonjour,</p>
            <p>Les signataires précédents ont terminé — c'est maintenant votre tour de signer le document suivant :</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0;font-size:16px;font-weight:700;">${demande.titre}</p>
              ${demande.description ? `<p style="margin:8px 0 0;color:#6b7280;">${demande.description}</p>` : ''}
            </div>
            <p>Aucun compte n'est nécessaire. Cliquez sur le bouton ci-dessous, indiquez votre nom et prénom, puis signez le document :</p>
            <a href="${lienSignature}" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
              Signer le document
            </a>
            <p style="margin-top:16px;color:#9ca3af;font-size:12px;">Ce lien est personnel et valable 30 jours. Ne le partagez pas.</p>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
          </div>
        `,
      }).catch((err: unknown) => console.error(`[Signatures] Email étape suivante externe error (${r.email}):`, err))
    }
  }
}

/**
 * Appelé après qu'un signataire (interne ou externe) vient de signer.
 * Notifie le créateur, et si tous les signataires ont signé : marque la demande
 * complète, propage au workflow contrat lié le cas échéant, et notifie le créateur.
 */
export async function finalizeAfterSignature(
  admin: AdminClient,
  demandeId: string,
  demande: { titre: string; description?: string | null; createur_id: string; fichier_url?: string | null },
  signerName: string,
  signerUserId: string | null
) {
  // Les observateurs (destinataires non-signataires) ne comptent pas dans le
  // calcul "tout le monde a signé" — ils ne signent jamais, ils reçoivent
  // seulement le document une fois complet (voir plus bas).
  const { data: allSigsRows } = await admin.from('signataires').select('signe, est_observateur').eq('demande_id', demandeId)
  const signataireRows = (allSigsRows ?? []).filter((s: { est_observateur: boolean }) => !s.est_observateur)
  const allSigned = signataireRows.length > 0 && signataireRows.every((s: { signe: boolean }) => s.signe)

  // Signature dans l'ordre choisi : si ce n'est pas fini, notifier le palier
  // suivant maintenant qu'il est peut-être devenu le premier non signé.
  if (!allSigned) await notifyNextStepIfReady(admin, demandeId, demande)

  // Notifie le créateur qu'une signature a été reçue (sauf s'il a signé son propre document)
  if (demande.createur_id !== signerUserId) {
    await admin.from('notifications').insert({
      user_id: demande.createur_id,
      titre: allSigned ? 'Document entièrement signé' : 'Signature reçue',
      message: allSigned
        ? `Tous les signataires ont signé « ${demande.titre} » — document complet ✓`
        : `${signerName} a signé « ${demande.titre} »`,
      lien: `/signatures/${demandeId}/view`,
    }).then(({ error: e }: { error: unknown }) => { if (e) console.error('[Signatures] Creator notif error:', e) })
  }

  if (!allSigned) return { allSigned: false }

  await admin.from('demandes_signature').update({ statut: 'complete', updated_at: new Date().toISOString() }).eq('id', demandeId)

  // Si lié à un contrat, mettre à jour le workflow
  const { data: contratLie } = await admin.from('contrats')
    .select('id, workflow_statut, categorie_document, type_contrat, numero, profile_id, destinataire_email')
    .eq('demande_signature_id', demandeId).single()

  if (contratLie && contratLie.workflow_statut === 'envoye_signataire') {
    await admin.from('contrats').update({ workflow_statut: 'signe_signataire' }).eq('id', contratLie.id)
    const { data: rhs } = await admin.from('profiles').select('id').in('role', ['rh', 'admin', 'caf'])
    for (const rh of rhs ?? []) {
      const { error: notifRhErr } = await admin.from('notifications').insert({
        user_id: rh.id,
        titre: 'Contrat signé par le signataire ✓',
        message: `${signerName} a signé le contrat. Vous pouvez maintenant le finaliser et envoyer le document à l'employé.`,
        lien: '/rh/contrats',
      })
      if (notifRhErr) console.error('[Signatures] notif in-app RH (contrat signataire):', notifRhErr)
    }
  } else if (contratLie && contratLie.workflow_statut === 'envoye_de') {
    // Offre (de stage ou non) : le DE vient de signer → bascule automatique
    // vers le/la bénéficiaire, qui peut avoir un compte My ABED ou pas encore.
    await admin.from('contrats').update({ workflow_statut: 'envoye_employe' }).eq('id', contratLie.id)
    const categorie = contratLie.categorie_document ?? 'Offre'
    const categorieLower = categorie.toLowerCase()

    if (contratLie.profile_id) {
      const { data: beneficiaire } = await admin.from('profiles').select('email, prenoms, nom, civilite').eq('id', contratLie.profile_id).single()
      const { error: notifBeneficiaireErr } = await admin.from('notifications').insert({
        user_id: contratLie.profile_id,
        titre: `${categorie} à signer`,
        message: `Votre ${categorieLower} (réf. ${contratLie.numero ?? contratLie.id}) est signée par la direction et attend votre signature.`,
        lien: '/mes-contrats',
      })
      if (notifBeneficiaireErr) console.error('[Signatures] notif in-app bénéficiaire:', notifBeneficiaireErr)
      if (beneficiaire?.email) {
        await sendEmail({
          to: beneficiaire.email,
          subject: `[My ABED] Votre ${categorieLower} à signer`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">ABED ONG — Votre ${categorieLower}</h2>
            <p>Bonjour ${beneficiaire.civilite ?? ''} ${beneficiaire.prenoms} ${beneficiaire.nom},</p>
            <p>Votre ${categorieLower} (réf. ${contratLie.numero ?? ''}) a été signée par la direction et est disponible pour votre signature.</p>
            <a href="${APP_URL}/mes-contrats" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Consulter et signer</a>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">ABED-ONG · my.abedong.org</p>
          </div>`,
        }).catch(err => console.error('[Signatures] email bénéficiaire error:', err))
      }
    } else if (contratLie.destinataire_email) {
      // Pas encore de compte My ABED — lien signé (72h), même mécanisme que
      // pour une Offre classique envoyée à un destinataire externe.
      const now = new Date()
      const expireLe = new Date(now.getTime() + 72 * 60 * 60 * 1000)
      await admin.from('contrats').update({
        lien_externe_genere_le: now.toISOString(),
        lien_externe_expire_le: expireLe.toISOString(),
      }).eq('id', contratLie.id)

      const lienToken = signContratExterneToken(contratLie.id, contratLie.destinataire_email)
      const lienExterne = `${APP_URL}/contrats/externe?t=${lienToken}`
      await sendEmail({
        to: contratLie.destinataire_email,
        subject: `[ABED ONG] Votre ${categorieLower} à signer`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">ABED ONG — Votre ${categorieLower}</h2>
          <p>Bonjour,</p>
          <p>Votre ${categorieLower} (réf. ${contratLie.numero ?? ''}) a été signée par la direction et est disponible pour votre signature. Aucun compte n'est nécessaire.</p>
          <a href="${lienExterne}" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Consulter et signer</a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Ce lien est personnel et expire dans 72 heures. ABED-ONG · my.abedong.org</p>
        </div>`,
      }).catch(err => console.error('[Signatures] email bénéficiaire externe error:', err))
    }
  }

  const { data: createur } = await admin.from('profiles').select('nom, prenoms, email').eq('id', demande.createur_id).single()
  if (createur?.email) {
    await sendEmail({
      to: createur.email,
      subject: `My ABED — Document entièrement signé : ${demande.titre}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#16a34a;">My ABED — Toutes les signatures recueillies ✓</h2>
        <p>Bonjour <strong>${createur.prenoms} ${createur.nom}</strong>,</p>
        <p>Tous les signataires ont signé le document <strong>${demande.titre}</strong>.</p>
        <a href="${APP_URL}/signatures/${demandeId}/view" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">Voir le document</a>
        <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
      </div>`,
    }).catch(err => console.error('[Signatures] Creator email error:', err))
  }

  // Destinataires non-signataires : reçoivent le document final par email,
  // en pièce jointe, une fois que tout le monde a signé.
  const { data: observateurs } = await admin
    .from('signataires')
    .select('profile_id, email, nom_externe, profile:profiles!signataires_profile_id_fkey(nom, prenoms, email)')
    .eq('demande_id', demandeId)
    .eq('est_observateur', true)

  if (observateurs && observateurs.length > 0 && demande.fichier_url) {
    // Recompose le PDF final depuis l'original intact + tous les tampons
    // enregistrés, plutôt que de télécharger le fichier partagé tel quel
    // (voir composeSignedPdf — élimine le risque qu'une signature ait été
    // perdue lors d'une mutation en place antérieure).
    const composed = await composeSignedPdf(admin, demandeId, demande.fichier_url)
    if (composed) {
      const contentB64 = Buffer.from(composed).toString('base64')
      const filename = `${demande.titre.replace(/[^a-zA-Z0-9._ -]/g, '_') || 'document'}.pdf`

      for (const obs of observateurs) {
        const p = obs.profile as unknown as { nom: string; prenoms: string; email: string | null } | null
        const email = p?.email ?? obs.email
        const nom = p ? `${p.prenoms} ${p.nom}` : (obs.nom_externe ?? '')
        if (!email) continue

        if (obs.profile_id) {
          await admin.from('notifications').insert({
            user_id: obs.profile_id,
            titre: '✓ Document signé',
            message: `Le document « ${demande.titre} » a été signé par tous les signataires. Vous le trouverez aussi en pièce jointe de l'email envoyé.`,
            lien: `/signatures/${demandeId}/view`,
          }).then(({ error: e }: { error: unknown }) => { if (e) console.error('[Signatures] Notif observateur error:', e) })
        }

        await sendEmail({
          to: email,
          subject: `My ABED — Document signé : ${demande.titre}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">My ABED — Document signé ✓</h2>
            <p>Bonjour${nom ? ` <strong>${nom}</strong>` : ''},</p>
            <p>Le document <strong>${demande.titre}</strong> a été signé par l'ensemble des signataires. Vous le trouverez en pièce jointe de cet email.</p>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
          </div>`,
          attachments: [{ filename, content: contentB64 }],
        }).catch(err => console.error(`[Signatures] email observateur error (${email}):`, err))
      }
    } else {
      console.error('[Signatures] Impossible de télécharger le document signé pour les observateurs')
    }
  }

  return { allSigned: true }
}
