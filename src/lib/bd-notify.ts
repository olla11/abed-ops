import { createAdminClient } from './supabase-server'
import { sendEmail } from './resend'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Notifie (in-app + email) les personnes nouvellement désignées comme
 * responsable de soumission ou associées à une opportunité BD — appelé à la
 * création et à chaque mise à jour (avec seulement les IDs réellement
 * NOUVEAUX, calculés par l'appelant en comparant avant/après).
 */
export async function notifierAssignationBD(admin: Admin, opts: {
  opportuniteId: string
  titreOpportunite: string
  bailleur: string | null
  dateLimite: string | null
  responsableId?: string | null
  nouveauxAssocies: string[]
}) {
  const { opportuniteId, titreOpportunite, bailleur, dateLimite, responsableId, nouveauxAssocies } = opts
  const dateStr = dateLimite ? new Date(dateLimite).toLocaleDateString('fr-FR') : null

  const cibles: { id: string; role: 'responsable' | 'associé' }[] = []
  if (responsableId) cibles.push({ id: responsableId, role: 'responsable' })
  for (const id of nouveauxAssocies) cibles.push({ id, role: 'associé' })
  if (cibles.length === 0) return

  const { data: profils } = await admin
    .from('profiles')
    .select('id, prenoms, nom, email')
    .in('id', cibles.map(c => c.id))

  for (const cible of cibles) {
    const profil = (profils ?? []).find(p => p.id === cible.id)
    if (!profil) continue

    const titreRole = cible.role === 'responsable' ? 'responsable de la soumission' : 'associé(e)'
    const message = `Vous avez été désigné(e) ${titreRole} pour l'opportunité « ${titreOpportunite} »${bailleur ? ` (${bailleur})` : ''}.${dateStr ? ` Date limite : ${dateStr}.` : ''}`

    await admin.from('notifications').insert({
      user_id: profil.id,
      titre: 'Nouvelle opportunité BD',
      message,
      lien: `/bd/opportunites/${opportuniteId}`,
    })

    if (profil.email) {
      await sendEmail({
        to: profil.email,
        subject: `[My ABED] Nouvelle opportunité — ${titreOpportunite}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#166534">Nouvelle opportunité BD</h2>
            <p>Bonjour <strong>${profil.prenoms}</strong>,</p>
            <p>Vous avez été désigné(e) <strong>${titreRole}</strong> pour l'opportunité suivante :</p>
            <div style="background:#fafafa;border-left:4px solid #166534;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
              <p style="margin:0 0 6px;font-weight:700;font-size:16px">${titreOpportunite}</p>
              <p style="margin:0;color:#6b7280;font-size:14px">
                ${bailleur ? `Bailleur : ${bailleur}` : ''}${bailleur && dateStr ? ' &nbsp;|&nbsp; ' : ''}${dateStr ? `Date limite : ${dateStr}` : ''}
              </p>
            </div>
            <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED (menu BD) pour voir le détail.</p>
          </div>
        `,
      }).catch(console.error)
    }
  }
}
