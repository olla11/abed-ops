import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const ActiviteSchema = z.object({
  nom:          s.nom,
  projet_id:    s.uuid,
  description:  s.text,
  statut:       z.string().max(20).optional(),
  priorite:     z.string().max(20).optional(),
  assignee_id:  z.string().uuid('assignee_id invalide').nullable().optional(),
  date_echeance:s.date,
  parent_id:    z.string().uuid('parent_id invalide').nullable().optional(),
})

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
  const limited = rateLimit(req, { limit: 30, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(ActiviteSchema, body)
  if ('error' in v) return v.error

  const { data, error } = await supabase.from('activites').insert({
    projet_id: v.data.projet_id,
    nom: v.data.nom.trim(),
    description: v.data.description?.trim() || null,
    statut: v.data.statut ?? 'a_faire',
    priorite: v.data.priorite ?? 'normale',
    assignee_id: v.data.assignee_id || null,
    date_echeance: v.data.date_echeance || null,
    created_by: user.id,
    parent_id: v.data.parent_id || null,
  }).select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms, email), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id), projet:projets_internes!activites_projet_id_fkey(nom)`).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification (in-app + email) si assigné à quelqu'un d'autre que soi-même
  if (data.assignee_id && data.assignee_id !== user.id) {
    const { data: creatorProfile } = await supabase.from('profiles').select('prenoms, nom').eq('id', user.id).single()
    const admin = createAdminClient()
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: data.assignee_id,
      titre: 'Nouvelle tâche assignée',
      message: `${creatorProfile?.prenoms ?? 'Quelqu\'un'} vous a assigné la tâche « ${data.nom} »${data.projet?.nom ? ` (${data.projet.nom})` : ''}.`,
      lien: `/projets/${data.projet_id}`,
    })
    if (notifErr) console.error(notifErr)
    if (data.assignee?.email) {
      const email = emailAssignation(data.nom, data.projet?.nom ?? '', data.assignee.prenoms, data.assignee.nom, creatorProfile?.prenoms ?? 'Quelqu\'un', data.date_echeance)
      await sendEmail({ to: data.assignee.email, ...email }).catch(console.error)
    }
  }

  // On retourne sans les champs email (sécurité)
  const { assignee, ...rest } = data
  return NextResponse.json({ data: { ...rest, assignee: assignee ? { id: assignee.id, nom: assignee.nom, prenoms: assignee.prenoms } : null } })
}
