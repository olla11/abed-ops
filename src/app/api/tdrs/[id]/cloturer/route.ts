import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { chapitresValides } from '@/lib/tdr'
import { sanitizeChapitres } from '@/lib/tdr-sanitize'
import { notifyTdr } from '@/lib/tdr-notify'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

// Étape finale du responsable (= initiateur du TDR, distinct du responsable
// technique) : signe le rapport de réconciliation déjà validé par l'AAF et le
// CAF, ce qui clôture le TDR — ou le refuse (retour à "actif" chez l'AAF).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const { data: tdr } = await supabase.from('tdrs').select('*').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })

  const estResponsable = tdr.initiateur_id === user.id
  if (!estResponsable && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Accès réservé au responsable du TDR' }, { status: 403 })
  }
  if (tdr.statut !== 'reconciliation_responsable') {
    return NextResponse.json({ error: 'Ce TDR n\'attend pas votre signature' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const action = body?.action === 'refuser' ? 'refuser' : 'signer'
  const admin = createAdminClient()

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

    const { data: aafUsers } = await admin.from('profiles').select('id, nom, prenoms, email').in('role', ['aaf', 'caf']).eq('archived', false)
    const titre = 'Rapport de réconciliation TDR refusé'
    const message = `Le responsable a refusé le rapport de réconciliation du TDR « ${tdr.titre_activite} » (${tdr.numero}). Motif : ${commentaire}`
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
              <a href="${APP_URL}/tdr/${id}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Voir le TDR →</a>
            </div>
          </div>`,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ ok: true, statut: 'actif' })
  }

  const update: Record<string, unknown> = {
    statut: 'cloture',
    reconciliation_responsable_signe_par: user.id,
    reconciliation_responsable_signe_le: new Date().toISOString(),
    cloture_par: user.id,
    cloture_le: new Date().toISOString(),
    cloture_notes: (body?.cloture_notes ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (body?.chapitres !== undefined) {
    if (!chapitresValides(body.chapitres)) {
      return NextResponse.json({ error: 'Les 8 chapitres du TDR sont obligatoires' }, { status: 400 })
    }
    update.chapitres = sanitizeChapitres(body.chapitres)
  }

  const { error } = await admin.from('tdrs').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyTdr(id, {
    titre: 'TDR clôturé',
    message: `Le TDR « ${tdr.titre_activite} » (${tdr.numero}) a été clôturé.`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true, statut: 'cloture' })
}
