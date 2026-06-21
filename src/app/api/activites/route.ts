import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

function emailAssignation(activiteNom: string, projetNom: string, assignePrenom: string, assigneNom: string, assigneurPrenom: string, echeance: string | null) {
  const dateStr = echeance ? new Date(echeance).toLocaleDateString('fr-FR') : 'non définie'
  return {
    subject: `[My ABED] Tâche assignée : ${activiteNom}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#16a34a">Nouvelle tâche assignée</h2>
        <p>Bonjour <strong>${assignePrenom}</strong>,</p>
        <p><strong>${assigneurPrenom}</strong> vous a assigné la tâche suivante :</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
          <p style="margin:0 0 6px;font-weight:700;font-size:16px">${activiteNom}</p>
          <p style="margin:0;color:#6b7280;font-size:14px">Projet : ${projetNom} &nbsp;|&nbsp; Échéance : ${dateStr}</p>
        </div>
        <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour voir les détails.</p>
      </div>
    `,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.nom?.trim() || !body?.projet_id) {
    return NextResponse.json({ error: 'Nom et projet_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('activites').insert({
    projet_id: body.projet_id,
    nom: body.nom.trim(),
    description: body.description?.trim() || null,
    statut: body.statut ?? 'a_faire',
    priorite: body.priorite ?? 'normale',
    assignee_id: body.assignee_id || null,
    date_echeance: body.date_echeance || null,
    created_by: user.id,
    parent_id: body.parent_id || null,
  }).select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms, email), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id), projet:projets_internes!activites_projet_id_fkey(nom)`).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Email si assigné à quelqu'un d'autre que soi-même
  if (data.assignee_id && data.assignee_id !== user.id && data.assignee?.email) {
    const { data: creatorProfile } = await supabase.from('profiles').select('prenoms, nom').eq('id', user.id).single()
    const email = emailAssignation(data.nom, data.projet?.nom ?? '', data.assignee.prenoms, data.assignee.nom, creatorProfile?.prenoms ?? 'Quelqu\'un', data.date_echeance)
    await sendEmail({ to: data.assignee.email, ...email }).catch(console.error)
  }

  // On retourne sans les champs email (sécurité)
  const { assignee, ...rest } = data
  return NextResponse.json({ data: { ...rest, assignee: assignee ? { id: assignee.id, nom: assignee.nom, prenoms: assignee.prenoms } : null } })
}
