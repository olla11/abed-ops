import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

// Un TdR clôturé n'est plus modifiable par personne. Seule exception : le
// CAF peut demander une réouverture motivée (ex. correction d'une facture),
// soumise à l'approbation de la trésorière générale du conseil
// d'administration — jamais un déverrouillage automatique.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (role !== 'caf' && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Accès réservé au CAF' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const motif = (body?.motif ?? '').trim()
  if (!motif) return NextResponse.json({ error: 'Le motif de la demande est obligatoire.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs').select('id, numero, titre_activite, statut, reouverte').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })
  if (tdr.statut !== 'cloture') return NextResponse.json({ error: 'Seul un TdR clôturé peut faire l\'objet d\'une demande de réouverture.' }, { status: 409 })
  if (tdr.reouverte) return NextResponse.json({ error: 'Ce TdR est déjà rouvert pour correction.' }, { status: 409 })

  const { error } = await admin.from('tdrs').update({
    reouverture_demandee_par: user.id,
    reouverture_demandee_le: new Date().toISOString(),
    reouverture_motif: motif,
    reouverture_autorisee_par: null,
    reouverture_autorisee_le: null,
    reouverture_refusee_par: null,
    reouverture_refusee_le: null,
    reouverture_refus_motif: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: tresoriers } = await admin.from('profiles').select('id, nom, prenoms, email').eq('titre', 'tresorier_ca').eq('archived', false)
  const titre = 'Demande de réouverture d\'un TdR clôturé'
  const message = `Le CAF demande la réouverture du TdR « ${tdr.titre_activite} » (${tdr.numero}) pour correction. Motif : ${motif}`
  for (const p of tresoriers ?? []) {
    await admin.from('notifications').insert({ user_id: p.id, titre, message, lien: `/tdr/${id}` })
    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${titre}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#b45309;color:white;padding:20px 28px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">${titre}</h1></div>
          <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Bonjour <strong>${p.prenoms}</strong>,</p>
            <p style="color:#374151;">${message}</p>
            <a href="${APP_URL}/tdr/${id}" style="display:inline-block;background:#b45309;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Examiner la demande →</a>
          </div>
        </div>`,
      }).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true })
}
