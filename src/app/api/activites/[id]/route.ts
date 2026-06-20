import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)

  // Lire l'ancienne valeur d'assignee pour détecter un changement
  const { data: ancien } = await supabase.from('activites').select('assignee_id').eq('id', params.id).single()

  const update: Record<string, unknown> = {}
  if (body.nom !== undefined) update.nom = body.nom
  if (body.description !== undefined) update.description = body.description
  if (body.statut !== undefined) update.statut = body.statut
  if (body.priorite !== undefined) update.priorite = body.priorite
  if (body.assignee_id !== undefined) update.assignee_id = body.assignee_id
  if (body.date_echeance !== undefined) update.date_echeance = body.date_echeance

  const { data, error } = await supabase
    .from('activites').update(update).eq('id', params.id)
    .select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms, email), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id), projet:projets_internes!activites_projet_id_fkey(nom)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Email si l'assignée a changé vers quelqu'un d'autre que soi-même
  const nouveauAssignee = data.assignee_id
  if (
    body.assignee_id !== undefined &&
    nouveauAssignee &&
    nouveauAssignee !== user.id &&
    nouveauAssignee !== ancien?.assignee_id &&
    data.assignee?.email
  ) {
    const { data: creatorProfile } = await supabase.from('profiles').select('prenoms, nom').eq('id', user.id).single()
    const dateStr = data.date_echeance ? new Date(data.date_echeance).toLocaleDateString('fr-FR') : 'non définie'
    await sendEmail({
      to: data.assignee.email,
      subject: `[My ABED] Tâche assignée : ${data.nom}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#16a34a">Tâche assignée</h2>
          <p>Bonjour <strong>${data.assignee.prenoms}</strong>,</p>
          <p><strong>${creatorProfile?.prenoms ?? 'Quelqu\'un'}</strong> vous a assigné la tâche suivante :</p>
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px">${data.nom}</p>
            <p style="margin:0;color:#6b7280;font-size:14px">Projet : ${data.projet?.nom ?? ''} &nbsp;|&nbsp; Échéance : ${dateStr}</p>
          </div>
          <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour voir les détails.</p>
        </div>
      `,
    }).catch(console.error)
  }

  const { assignee, projet, ...rest } = data
  return NextResponse.json({ data: { ...rest, assignee: assignee ? { id: assignee.id, nom: assignee.nom, prenoms: assignee.prenoms } : null } })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { error } = await supabase.from('activites').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
