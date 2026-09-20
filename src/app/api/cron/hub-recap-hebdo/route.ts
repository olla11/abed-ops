import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Cron job — tous les lundis à 7h (sauf en décembre). Récapitulatif
// hebdomadaire du Hub : un mail par espace, envoyé à ses membres, listant
// les activités de la semaine (lundi → dimanche) groupées par projet avec
// leur responsable. Silencieux (aucun mail) si l'espace n'a aucune activité
// prévue cette semaine — pas de mail "rien à signaler".
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Pause de décembre — demandée explicitement (fin d'année chargée,
  // beaucoup d'espaces au ralenti, le récap hebdo n'apporte rien).
  if (today.getMonth() === 11) {
    return NextResponse.json({ ok: true, skipped: 'decembre' })
  }

  const semaineDebut = today.toISOString().slice(0, 10)
  const semaineFinDate = new Date(today)
  semaineFinDate.setDate(today.getDate() + 6)
  const semaineFin = semaineFinDate.toISOString().slice(0, 10)

  const supabase = createAdminClient()

  const [{ data: espaces }, { data: membresRows }, { data: projets }, { data: activites }] = await Promise.all([
    supabase.from('espaces').select('id, nom, created_by'),
    supabase.from('espace_membres').select('espace_id, profile_id'),
    supabase.from('projets_internes').select('id, nom, espace_id').not('espace_id', 'is', null),
    supabase.from('activites')
      .select(`
        id, nom, statut, date_debut, date_echeance, projet_id, parent_id,
        assignee:profiles!activites_assignee_id_fkey(prenoms, nom)
      `)
      .neq('statut', 'termine')
      .or(`date_debut.not.is.null,date_echeance.not.is.null`),
  ])

  if (!espaces?.length || !projets?.length || !activites?.length) {
    return NextResponse.json({ ok: true, espacesEnvoyes: 0 })
  }

  // Une activité "de la semaine" est celle dont la plage [début, échéance]
  // (l'un des deux peut manquer — on retombe alors sur l'autre) chevauche
  // la semaine lundi → dimanche, même partiellement — même logique que la
  // vue Calendrier du projet (activiteCouvreJour dans ProjetDetailClient.tsx).
  function estDeLaSemaine(debut: string | null, fin: string | null): boolean {
    const d = debut ?? fin
    const f = fin ?? debut
    if (!d || !f) return false
    return d <= semaineFin && f >= semaineDebut
  }

  const activitesDeLaSemaine = activites.filter(a => !a.parent_id && estDeLaSemaine(a.date_debut, a.date_echeance))

  const projetsParEspace = new Map<string, { id: string; nom: string }[]>()
  const projetById = new Map<string, { id: string; nom: string; espace_id: string }>()
  for (const p of projets) {
    projetById.set(p.id, p as any)
    const liste = projetsParEspace.get(p.espace_id!) ?? []
    liste.push({ id: p.id, nom: p.nom })
    projetsParEspace.set(p.espace_id!, liste)
  }

  const activitesParProjet = new Map<string, typeof activitesDeLaSemaine>()
  for (const a of activitesDeLaSemaine) {
    const liste = activitesParProjet.get(a.projet_id) ?? []
    liste.push(a)
    activitesParProjet.set(a.projet_id, liste)
  }

  const membresParEspace = new Map<string, Set<string>>()
  for (const m of membresRows ?? []) {
    const set = membresParEspace.get(m.espace_id) ?? new Set<string>()
    set.add(m.profile_id)
    membresParEspace.set(m.espace_id, set)
  }

  const periodeLabel = `${new Date(semaineDebut + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} — ${new Date(semaineFin + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  let espacesEnvoyes = 0
  let mailsEnvoyes = 0

  for (const esp of espaces) {
    const projetsEspace = projetsParEspace.get(esp.id) ?? []
    if (!projetsEspace.length) continue

    // Regroupement par projet, projets sans activité cette semaine omis.
    const blocsProjet = projetsEspace
      .map(p => ({ projet: p, activites: activitesParProjet.get(p.id) ?? [] }))
      .filter(b => b.activites.length > 0)

    if (!blocsProjet.length) continue // rien à signaler cette semaine — pas de mail

    // Membres = ceux inscrits dans espace_membres + le/la créateur·rice de
    // l'espace (qui n'y figure pas forcément lui-même/elle-même).
    const idsMembres = new Set(membresParEspace.get(esp.id) ?? [])
    if (esp.created_by) idsMembres.add(esp.created_by)
    if (!idsMembres.size) continue

    const { data: destinataires } = await supabase
      .from('profiles').select('id, prenoms, nom, email').in('id', [...idsMembres])
    if (!destinataires?.length) continue

    const corpsProjets = blocsProjet.map(({ projet, activites: acts }) => `
      <div style="margin-bottom:18px">
        <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:#111827">${projet.nom}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          ${acts.map(a => `
            <tr>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;color:#374151">${a.nom}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;white-space:nowrap">
                ${(a.assignee as any) ? `${(a.assignee as any).prenoms} ${(a.assignee as any).nom}` : 'Non assigné'}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('')

    espacesEnvoyes++

    for (const dest of destinataires) {
      if (!dest.email) continue
      await sendEmail({
        to: dest.email,
        subject: `[My ABED] Récap de la semaine — ${esp.nom} (${periodeLabel})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#16a34a;margin:0 0 4px">📋 Récap hebdomadaire — ${esp.nom}</h2>
            <p style="color:#9ca3af;font-size:13px;margin:0 0 20px">Semaine du ${periodeLabel}</p>
            <p>Bonjour <strong>${dest.prenoms}</strong>,</p>
            <p>Voici les activités prévues cette semaine dans l'espace « ${esp.nom} », par projet :</p>
            ${corpsProjets}
            <a href="${appUrl}/projets" style="display:inline-block;margin-top:8px;background:#16a34a;color:white;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">
              Voir dans My ABED →
            </a>
          </div>
        `,
      }).catch(console.error)
      mailsEnvoyes++
    }
  }

  return NextResponse.json({ ok: true, espacesEnvoyes, mailsEnvoyes })
}
