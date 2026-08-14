import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

// Étape CAF de la réconciliation : signe le rapport préparé par l'AAF (le
// dossier passe ensuite chez le responsable du TDR pour signature finale
// avant clôture), ou le refuse (retour à "actif" chez l'AAF avec motif).
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
  const action = body?.action === 'refuser' ? 'refuser' : 'signer'

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs')
    .select('id, numero, titre_activite, statut, initiateur_id')
    .eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })
  if (tdr.statut !== 'reconciliation_caf') {
    return NextResponse.json({ error: "Ce TdR n'attend pas la signature du CAF" }, { status: 409 })
  }

  if (action === 'refuser') {
    const commentaire = (body?.commentaire ?? '').trim()
    if (!commentaire) return NextResponse.json({ error: 'Un motif de refus est requis' }, { status: 400 })

    const { error } = await admin.from('tdrs').update({
      statut: 'actif',
      dernier_refus_par: user.id,
      dernier_refus_commentaire: commentaire,
      dernier_refus_le: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { data: aafUsers } = await admin.from('profiles').select('id, nom, prenoms, email').eq('role', 'aaf').eq('archived', false)
    const titre = 'Rapport de réconciliation TdR refusé'
    const message = `Le CAF a refusé le rapport de réconciliation du TdR « ${tdr.titre_activite} » (${tdr.numero}). Motif : ${commentaire}`
    for (const p of aafUsers ?? []) {
      await admin.from('notifications').insert({ user_id: p.id, titre, message, lien: `/tdr/${id}` })
      if (p.email) {
        await sendEmail({
          to: p.email,
          subject: `[My ABED] ${titre}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#dc2626;color:white;padding:20px 28px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">${titre}</h1></div>
            <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p>Bonjour <strong>${p.prenoms}</strong>,</p>
              <p style="color:#374151;">${message}</p>
              <a href="${APP_URL}/tdr/${id}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Voir le TdR →</a>
            </div>
          </div>`,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ ok: true, statut: 'actif' })
  }

  const { error } = await admin.from('tdrs').update({
    statut: 'reconciliation_responsable',
    reconciliation_caf_signe_par: user.id,
    reconciliation_caf_signe_le: new Date().toISOString(),
    dernier_refus_par: null,
    dernier_refus_commentaire: null,
    dernier_refus_le: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: responsable } = await admin.from('profiles').select('id, nom, prenoms, email').eq('id', tdr.initiateur_id).single()
  if (responsable) {
    const titre = 'Rapport de réconciliation TdR à signer'
    const message = `Le rapport de réconciliation du TdR « ${tdr.titre_activite} » (${tdr.numero}) a été signé par le CAF — en attente de votre signature pour clôturer le TdR.`
    await admin.from('notifications').insert({ user_id: responsable.id, titre, message, lien: `/tdr/${id}` })
    if (responsable.email) {
      await sendEmail({
        to: responsable.email,
        subject: `[My ABED] ${titre}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#16a34a;color:white;padding:20px 28px;border-radius:8px 8px 0 0;"><h1 style="margin:0;font-size:18px;">${titre}</h1></div>
          <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p>Bonjour <strong>${responsable.prenoms}</strong>,</p>
            <p style="color:#374151;">${message}</p>
            <a href="${APP_URL}/tdr/${id}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Voir le TdR →</a>
          </div>
        </div>`,
      }).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true, statut: 'reconciliation_responsable' })
}
