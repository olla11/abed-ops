import { sendEmail } from '@/lib/resend'
import { createAdminClient } from '@/lib/supabase-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Appelé après qu'un signataire (interne ou externe) vient de signer.
 * Notifie le créateur, et si tous les signataires ont signé : marque la demande
 * complète, propage au workflow contrat lié le cas échéant, et notifie le créateur.
 */
export async function finalizeAfterSignature(
  admin: AdminClient,
  demandeId: string,
  demande: { titre: string; createur_id: string; fichier_url?: string | null },
  signerName: string,
  signerUserId: string | null
) {
  // Les observateurs (destinataires non-signataires) ne comptent pas dans le
  // calcul "tout le monde a signé" — ils ne signent jamais, ils reçoivent
  // seulement le document une fois complet (voir plus bas).
  const { data: allSigsRows } = await admin.from('signataires').select('signe, est_observateur').eq('demande_id', demandeId)
  const signataireRows = (allSigsRows ?? []).filter((s: { est_observateur: boolean }) => !s.est_observateur)
  const allSigned = signataireRows.length > 0 && signataireRows.every((s: { signe: boolean }) => s.signe)

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
    .select('id, workflow_statut, categorie_document, type_contrat, numero, profile_id')
    .eq('demande_signature_id', demandeId).single()

  if (contratLie && contratLie.workflow_statut === 'envoye_signataire') {
    await admin.from('contrats').update({ workflow_statut: 'signe_signataire' }).eq('id', contratLie.id)
    const { data: rhs } = await admin.from('profiles').select('id').in('role', ['rh', 'admin'])
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
    // Offre de stage : le DE vient de signer → bascule automatique vers le stagiaire
    await admin.from('contrats').update({ workflow_statut: 'envoye_employe' }).eq('id', contratLie.id)
    const { data: stagiaire } = await admin.from('profiles').select('email, prenoms, nom, civilite').eq('id', contratLie.profile_id).single()
    const { error: notifStagiaireErr } = await admin.from('notifications').insert({
      user_id: contratLie.profile_id,
      titre: 'Offre de stage à signer',
      message: `Votre offre de stage (réf. ${contratLie.numero ?? contratLie.id}) est signée par la direction et attend votre signature.`,
      lien: '/mes-contrats',
    })
    if (notifStagiaireErr) console.error('[Signatures] notif in-app stagiaire:', notifStagiaireErr)
    if (stagiaire?.email) {
      await sendEmail({
        to: stagiaire.email,
        subject: `[My ABED] Votre offre de stage à signer`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">ABED ONG — Votre offre de stage</h2>
          <p>Bonjour ${stagiaire.civilite ?? ''} ${stagiaire.prenoms} ${stagiaire.nom},</p>
          <p>Votre offre de stage (réf. ${contratLie.numero ?? ''}) a été signée par la direction et est disponible pour votre signature.</p>
          <a href="${APP_URL}/mes-contrats" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Consulter et signer</a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">ABED-ONG · my.abedong.org</p>
        </div>`,
      }).catch(err => console.error('[Signatures] email stagiaire error:', err))
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
    const { data: fileData } = await admin.storage.from('documents').download(demande.fichier_url)
    if (fileData) {
      const contentB64 = Buffer.from(await fileData.arrayBuffer()).toString('base64')
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
