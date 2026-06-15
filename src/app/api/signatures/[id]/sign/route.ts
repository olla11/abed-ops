import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: demandeId } = await params

  // Parse optional body for position data
  let sig_x: number | undefined
  let sig_y: number | undefined
  let sig_page: number | undefined
  try {
    const body = await req.json()
    if (typeof body.sig_x === 'number') sig_x = body.sig_x
    if (typeof body.sig_y === 'number') sig_y = body.sig_y
    if (typeof body.sig_page === 'number') sig_page = body.sig_page
  } catch {
    // Body may be empty (direct sign without position)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the demande
  const { data: demande, error: demandeErr } = await admin
    .from('demandes_signature')
    .select('id, titre, statut, createur_id')
    .eq('id', demandeId)
    .single()

  if (demandeErr || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  if (demande.statut === 'complete') {
    return NextResponse.json({ error: 'Cette demande est déjà complète' }, { status: 400 })
  }

  // Verify this user is a signatory and hasn't signed yet
  const { data: signataire, error: sigErr } = await admin
    .from('signataires')
    .select('id, signe')
    .eq('demande_id', demandeId)
    .eq('profile_id', user.id)
    .single()

  if (sigErr || !signataire) {
    return NextResponse.json({ error: 'Vous n\'êtes pas signataire de ce document' }, { status: 403 })
  }

  if (signataire.signe) {
    return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })
  }

  // Try to update with position columns; fall back to basic sign if columns missing
  const updateWithPos: Record<string, unknown> = {
    signe: true, signe_le: new Date().toISOString(),
    ...(sig_x !== undefined && { sig_x }),
    ...(sig_y !== undefined && { sig_y }),
    ...(sig_page !== undefined && { sig_page }),
  }

  let { error: updateErr } = await admin
    .from('signataires')
    .update(updateWithPos)
    .eq('id', signataire.id)

  // If error likely due to missing position columns, retry without them
  if (updateErr && (sig_x !== undefined || sig_y !== undefined)) {
    console.warn('[Signatures] Retrying without position columns:', updateErr.message)
    const res2 = await admin
      .from('signataires')
      .update({ signe: true, signe_le: new Date().toISOString() })
      .eq('id', signataire.id)
    updateErr = res2.error
  }

  if (updateErr) {
    console.error('[Signatures] Update signataire error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }

  // Check if ALL signataires have now signed
  const { data: allSigs } = await admin
    .from('signataires')
    .select('signe')
    .eq('demande_id', demandeId)

  const allSigned = allSigs?.every(s => s.signe) ?? false

  if (allSigned) {
    // Update demande statut to 'complete'
    await admin
      .from('demandes_signature')
      .update({ statut: 'complete', updated_at: new Date().toISOString() })
      .eq('id', demandeId)

    // Send confirmation email to creator
    const { data: createur } = await admin
      .from('profiles')
      .select('nom, prenoms, email')
      .eq('id', demande.createur_id)
      .single()

    if (createur?.email) {
      await sendEmail({
        to: createur.email,
        subject: `My ABED — Document entièrement signé : ${demande.titre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">My ABED — Toutes les signatures recueillies ✓</h2>
            <p>Bonjour <strong>${createur.prenoms} ${createur.nom}</strong>,</p>
            <p>Tous les signataires ont signé le document suivant :</p>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#166534;">${demande.titre}</p>
            </div>
            <p>Vous pouvez consulter l'historique complet des signatures sur My ABED :</p>
            <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
              Voir le document
            </a>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
          </div>
        `,
      }).catch(err => console.error('[Signatures] Creator email error:', err))
    }
  }

  return NextResponse.json({ ok: true, allSigned })
}
