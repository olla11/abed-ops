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
  demande: { titre: string; createur_id: string },
  signerName: string,
  signerUserId: string | null
) {
  const { data: allSigs } = await admin.from('signataires').select('signe').eq('demande_id', demandeId)
  const allSigned = allSigs?.every((s: { signe: boolean }) => s.signe) ?? false

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

  return { allSigned: true }
}
