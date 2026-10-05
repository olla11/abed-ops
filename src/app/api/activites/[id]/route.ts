import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Notification (in-app + email) commune à l'assignation du responsable et à
// l'ajout d'une personne associée — seul le libellé change selon le rôle.
async function notifierAffectation(admin: ReturnType<typeof createAdminClient>, opts: {
  userId: string; email: string | null; prenoms: string; creatorPrenom: string
  role: 'assignee' | 'associe'; nomTache: string; nomProjet: string | null; projetId: string; echeance: string | null
}) {
  const estAssignee = opts.role === 'assignee'
  const titre = estAssignee ? 'Nouvelle tâche assignée' : 'Ajouté·e comme personne associée'
  const verbe = estAssignee ? 'vous a assigné' : 'vous a associé·e à'
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: opts.userId,
    titre,
    message: `${opts.creatorPrenom} ${verbe} la tâche « ${opts.nomTache} »${opts.nomProjet ? ` (${opts.nomProjet})` : ''}.`,
    lien: `/projets/${opts.projetId}`,
  })
  if (notifErr) console.error(notifErr)

  if (!opts.email) return
  const dateStr = opts.echeance ? new Date(opts.echeance).toLocaleDateString('fr-FR') : 'non définie'
  await sendEmail({
    to: opts.email,
    subject: `[My ABED] ${estAssignee ? 'Tâche assignée' : 'Tâche partagée'} : ${opts.nomTache}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#16a34a">${titre}</h2>
        <p>Bonjour <strong>${opts.prenoms}</strong>,</p>
        <p><strong>${opts.creatorPrenom}</strong> ${verbe} la tâche suivante :</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
          <p style="margin:0 0 6px;font-weight:700;font-size:16px">${opts.nomTache}</p>
          <p style="margin:0;color:#6b7280;font-size:14px">Projet : ${opts.nomProjet ?? ''} &nbsp;|&nbsp; Échéance : ${dateStr}</p>
        </div>
        <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour voir les détails.</p>
      </div>
    `,
  }).catch(console.error)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)

  // Lire les anciennes valeurs pour détecter un changement d'assignee et les
  // nouvelles personnes associées (pas déjà présentes avant ce patch).
  const { data: ancien } = await supabase.from('activites').select('assignee_id, associe_ids').eq('id', id).single()

  const update: Record<string, unknown> = {}
  if (body.nom !== undefined) update.nom = body.nom
  if (body.description !== undefined) update.description = body.description
  if (body.statut !== undefined) update.statut = body.statut
  if (body.priorite !== undefined) update.priorite = body.priorite
  if (body.assignee_id !== undefined) update.assignee_id = body.assignee_id
  if (body.associe_ids !== undefined) update.associe_ids = body.associe_ids
  if (body.date_debut !== undefined) update.date_debut = body.date_debut
  if (body.date_echeance !== undefined) update.date_echeance = body.date_echeance

  const { data, error } = await supabase
    .from('activites').update(update).eq('id', id)
    .select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms, email), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id), projet:projets_internes!activites_projet_id_fkey(nom)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: creatorProfile } = await supabase.from('profiles').select('prenoms, nom').eq('id', user.id).single()
  const creatorPrenom = creatorProfile?.prenoms ?? 'Quelqu\'un'
  const admin = createAdminClient()

  // Notification si l'assignée a changé vers quelqu'un d'autre que soi-même
  const nouveauAssignee = data.assignee_id
  if (
    body.assignee_id !== undefined &&
    nouveauAssignee &&
    nouveauAssignee !== user.id &&
    nouveauAssignee !== ancien?.assignee_id &&
    data.assignee
  ) {
    await notifierAffectation(admin, {
      userId: nouveauAssignee, email: data.assignee.email, prenoms: data.assignee.prenoms, creatorPrenom,
      role: 'assignee', nomTache: data.nom, nomProjet: data.projet?.nom ?? null, projetId: data.projet_id, echeance: data.date_echeance,
    })
  }

  // Notification pour chaque personne nouvellement associée (pas celles déjà
  // présentes avant ce patch — jamais se notifier soi-même non plus).
  if (body.associe_ids !== undefined) {
    const idsAvant = new Set(ancien?.associe_ids ?? [])
    const nouveaux = (data.associe_ids as string[] ?? []).filter((aid: string) => aid !== user.id && !idsAvant.has(aid))
    if (nouveaux.length > 0) {
      const { data: profils } = await admin.from('profiles').select('id, prenoms, nom, email').in('id', nouveaux)
      for (const p of profils ?? []) {
        await notifierAffectation(admin, {
          userId: p.id, email: p.email, prenoms: p.prenoms, creatorPrenom,
          role: 'associe', nomTache: data.nom, nomProjet: data.projet?.nom ?? null, projetId: data.projet_id, echeance: data.date_echeance,
        })
      }
    }
  }

  const { assignee, projet, ...rest } = data
  return NextResponse.json({ data: { ...rest, assignee: assignee ? { id: assignee.id, nom: assignee.nom, prenoms: assignee.prenoms } : null } })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { error } = await supabase.from('activites').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
