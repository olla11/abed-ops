import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

// Seule la trésorière générale du conseil d'administration peut autoriser
// (ou refuser) la réouverture d'un TdR clôturé, sur demande motivée du CAF.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, titre').eq('id', user.id).single()
  const estTresoriere = profile?.titre === 'tresorier_ca'
  if (!estTresoriere && !['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Accès réservé à la trésorière générale du conseil d\'administration' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const action = body?.action === 'refuser' ? 'refuser' : 'approuver'

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs')
    .select('id, numero, titre_activite, statut, reouverte, reouverture_demandee_par')
    .eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })
  if (tdr.statut !== 'cloture' || tdr.reouverte || !tdr.reouverture_demandee_par) {
    return NextResponse.json({ error: 'Aucune demande de réouverture en attente pour ce TdR.' }, { status: 409 })
  }

  if (action === 'refuser') {
    const commentaire = (body?.commentaire ?? '').trim()
    if (!commentaire) return NextResponse.json({ error: 'Un motif de refus est requis.' }, { status: 400 })

    const { error } = await admin.from('tdrs').update({
      reouverture_refusee_par: user.id,
      reouverture_refusee_le: new Date().toISOString(),
      reouverture_refus_motif: commentaire,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await notifierCaf(admin, id, tdr, `La demande de réouverture du TdR « ${tdr.titre_activite} » (${tdr.numero}) a été refusée par la trésorière générale. Motif : ${commentaire}`, 'Demande de réouverture refusée')
    return NextResponse.json({ ok: true, reouverte: false })
  }

  const { error } = await admin.from('tdrs').update({
    reouverte: true,
    reouverture_autorisee_par: user.id,
    reouverture_autorisee_le: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await notifierCaf(admin, id, tdr, `La réouverture du TdR « ${tdr.titre_activite} » (${tdr.numero}) a été autorisée par la trésorière générale. Vous pouvez corriger les factures et le rapport de réconciliation, puis cliquer sur « Terminer » pour reclôturer.`, 'Réouverture autorisée')
  return NextResponse.json({ ok: true, reouverte: true })
}

async function notifierCaf(admin: ReturnType<typeof createAdminClient>, id: string, tdr: { titre_activite: string; numero: string | null }, message: string, titre: string) {
  const { data: cafUsers } = await admin.from('profiles').select('id, nom, prenoms, email').eq('role', 'caf').eq('archived', false)
  for (const p of cafUsers ?? []) {
    await admin.from('notifications').insert({ user_id: p.id, titre, message, lien: `/tdr/${id}` })
    if (p.email) {
      await sendEmail({
        to: p.email,
        subject: `[My ABED] ${titre}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#16a34a;color:white;padding:20px 28px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">${titre}</h1></div>
          <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Bonjour <strong>${p.prenoms}</strong>,</p>
            <p style="color:#374151;">${message}</p>
            <a href="${APP_URL}/tdr/${id}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Voir le TdR →</a>
          </div>
        </div>`,
      }).catch(console.error)
    }
  }
}
