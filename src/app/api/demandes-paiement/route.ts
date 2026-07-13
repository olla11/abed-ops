import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const DemandeSchema = z.object({
  nom_complet:      z.string().min(1).max(200),
  email_contact:    s.email,
  departement:      z.string().min(1).max(100),
  objet:            z.string().min(1).max(500),
  code_budgetaire:  z.string().min(1).max(100),
  projet:           z.string().min(1).max(200),
  nature_depense:   z.string().min(1).max(200),
  montant:          s.montant,
  mode_paiement:    z.string().min(1).max(100),
  beneficiaire:     z.string().min(1).max(200),
  reference_piece:  z.string().min(1).max(200),
  justification:    z.string().min(1).max(2000),
  urgence:          z.string().min(1).max(50),
  soumission_id:    z.string().uuid().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isTraiteur = ['aaf', 'caf', 'de', 'dp', 'admin', 'administrateur'].includes(role)

  let query = supabase
    .from('demandes_paiement')
    .select('*, demandeur:profiles!demandes_paiement_demandeur_id_fkey(nom,prenoms,email)')
    .order('created_at', { ascending: false })

  if (!isTraiteur) {
    query = query.eq('demandeur_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(DemandeSchema, body)
  if ('error' in v) return v.error

  const { soumission_id, ...demandeFields } = v.data

  const { data, error } = await supabase.from('demandes_paiement').insert({
    demandeur_id: user.id,
    ...demandeFields,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Marquer la soumission associée comme "demande soumise" pour masquer la bannière
  if (soumission_id) {
    await supabase
      .from('soumissions')
      .update({ status: 'demande_soumise' })
      .eq('id', soumission_id)
      .eq('prestataire_id', user.id)
  }

  // Notifier les AAF par email
  const { data: aafs } = await supabase
    .from('profiles').select('id, email, prenoms, nom').eq('role', 'aaf')

  for (const aaf of aafs ?? []) {
    await supabase.from('notifications').insert({
      user_id: aaf.id,
      titre: 'Nouvelle demande de paiement',
      message: `${v.data.nom_complet} — ${v.data.objet} — ${Number(v.data.montant).toLocaleString('fr-FR')} FCFA`,
      lien: '/demandes',
    })
    if (aaf.email) {
      try {
        await sendEmail({
          to: aaf.email,
          subject: `[ABED-ONG] Nouvelle demande de paiement à traiter`,
          html: buildEmailAAF({ body: v.data, aafNom: `${aaf.prenoms} ${aaf.nom}`, id: data.id }),
        })
      } catch (e) { console.error('[Email] AAF notif:', e) }
    }
  }

  return NextResponse.json({ ok: true, id: data.id })
}

function buildEmailAAF({ body, aafNom, id }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Demande de paiement en attente</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${aafNom}</strong>,</p>
      <p>Une nouvelle demande de paiement attend votre traitement.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Demandeur</td><td>${body.nom_complet}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Objet</td><td>${body.objet}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant</td><td><strong>${Number(body.montant).toLocaleString('fr-FR')} FCFA</strong></td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Urgence</td><td>${body.urgence}</td></tr>
      </table>
      <a href="${appUrl}/demandes" style="display:inline-block;background:#63a521;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">
        Traiter la demande →
      </a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}
