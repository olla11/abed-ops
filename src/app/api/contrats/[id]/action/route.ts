import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { revalidateTag } from 'next/cache'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

// POST /api/contrats/[id]/action
// body: { action: 'envoyer_signataire' | 'finaliser' | 'renvoyer_employe', signataire_id?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès réservé au RH' }, { status: 403 })

  const body = await req.json()
  const { action, signataire_id } = body

  const admin = createAdminClient()
  const { data: contrat } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, civilite)')
    .eq('id', id).single()

  if (!contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const profile = contrat.profile as any
  const nomEmploye = `${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`.trim()
  const ref = contrat.numero ?? contrat.id

  // ── Envoyer au signataire ──
  if (action === 'envoyer_signataire') {
    const sigId = signataire_id ?? contrat.signataire_id
    if (!sigId) return NextResponse.json({ error: 'Signataire requis' }, { status: 400 })

    const { data: sigProfile } = await admin.from('profiles').select('id, nom, prenoms, email').eq('id', sigId).single()
    if (!sigProfile) return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })

    // La signature du signataire (POST /signer-signataire) ne dépend plus de ce circuit
    // générique — il n'est conservé que pour l'affichage/historique dans /signatures.
    // Sa création est donc entièrement best-effort et ne doit jamais bloquer l'envoi du contrat.
    let demandeSignatureId = contrat.demande_signature_id as string | null
    if (demandeSignatureId) {
      const { error: delErr } = await admin.from('signataires').delete()
        .eq('demande_id', demandeSignatureId)
        .eq('profile_id', sigId)
      if (delErr) console.error('[contrat action] purge ancien signataire (best-effort):', delErr)
      const { error: insSigErr } = await admin.from('signataires').insert({
        demande_id: demandeSignatureId,
        profile_id: sigId,
        signe: false,
        ordre: 2,
      })
      if (insSigErr) console.error('[contrat action] insert signataire (best-effort):', insSigErr)
    } else {
      const { data: demande, error: demandeErr } = await admin.from('demandes_signature').insert({
        titre: `${contrat.categorie_document ?? 'Contrat'} ${contrat.type_contrat} — ${nomEmploye}`,
        description: `Réf. ${ref}`,
        createur_id: user.id,
        statut: 'en_attente',
      }).select('id').single()
      if (demandeErr || !demande) {
        console.error('[contrat action] création demande_signature (best-effort):', demandeErr)
      } else {
        const { error: insSigErr } = await admin.from('signataires').insert({ demande_id: demande.id, profile_id: sigId, signe: false, ordre: 1 })
        if (insSigErr) console.error('[contrat action] insert premier signataire (best-effort):', insSigErr)
        const { error: linkErr } = await admin.from('contrats').update({ demande_signature_id: demande.id }).eq('id', id)
        if (linkErr) console.error('[contrat action] liaison contrat/demande (best-effort):', linkErr)
        else demandeSignatureId = demande.id
      }
    }

    // Mettre à jour le contrat — l'envoi au signataire ne dépend pas du circuit ci-dessus
    const { error: updErr } = await admin.from('contrats').update({
      workflow_statut: 'envoye_signataire',
      signataire_id: sigId,
    }).eq('id', id)
    if (updErr) {
      console.error('[contrat action] update workflow_statut envoye_signataire:', updErr)
      return NextResponse.json({ error: "Échec de la mise à jour du contrat. Réessayez." }, { status: 500 })
    }

    // Notif in-app + email au signataire
    const { error: notifSigErr } = await admin.from('notifications').insert({
      user_id: sigId,
      titre: 'Contrat à signer',
      message: `Le ${contrat.categorie_document ?? 'contrat'} ${contrat.type_contrat} de ${nomEmploye} (réf. ${ref}) attend votre signature.`,
      lien: '/signatures',
    })
    if (notifSigErr) console.error('[contrat action] notif in-app signataire:', notifSigErr)

    if (sigProfile.email) {
      try {
        await sendEmail({
          to: sigProfile.email,
          subject: `[My ABED] Contrat à signer — ${nomEmploye}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Signature requise</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${sigProfile.prenoms} ${sigProfile.nom}</strong>,</p>
    <p style="font-size:14px;color:#374151;">Le document suivant requiert votre signature :</p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong>${ref}</strong> — ${contrat.type_contrat}<br/>
      <span style="font-size:13px;color:#6b7280;">Employé(e) : ${nomEmploye}</span>
    </div>
    <a href="${APP_URL}/signatures" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Signer le document →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[contrat action] email signataire:', e) }
    }

    revalidateTag('contrats')
    return NextResponse.json({ ok: true, workflow_statut: 'envoye_signataire' })
  }

  // ── Finaliser — envoyer le contrat signé à l'employé ──
  if (action === 'finaliser') {
    await admin.from('contrats').update({ workflow_statut: 'finalise' }).eq('id', id)

    // Notif in-app à l'employé
    const { error: notifFinaliseErr } = await admin.from('notifications').insert({
      user_id: contrat.profile_id,
      titre: 'Votre contrat est finalisé ✓',
      message: `Votre ${contrat.categorie_document ?? 'contrat'} ${contrat.type_contrat} (réf. ${ref}) est entièrement signé et disponible.`,
      lien: '/mes-contrats',
    })
    if (notifFinaliseErr) console.error('[contrat action] notif in-app finalisation:', notifFinaliseErr)

    // Email à l'employé
    if (profile?.email) {
      try {
        const pdfLien = contrat.demande_signature_id
          ? `${APP_URL}/signatures/${contrat.demande_signature_id}/view`
          : `${APP_URL}/mes-contrats`
        await sendEmail({
          to: profile.email,
          subject: `[My ABED] Votre contrat finalisé — ${ref}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">ABED ONG — Votre contrat est finalisé ✓</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour ${profile.civilite ?? ''} <strong>${profile.prenoms} ${profile.nom}</strong>,</p>
    <p style="font-size:14px;color:#374151;">
      Votre ${contrat.categorie_document?.toLowerCase() ?? 'contrat'} a été entièrement signé et est désormais disponible :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong style="color:#166534;">${ref}</strong><br/>
      <span style="font-size:13px;color:#374151;">${contrat.type_contrat} · Poste : ${contrat.poste ?? '—'}</span>
    </div>
    <a href="${pdfLien}" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Consulter mon contrat →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[contrat action] email finalise:', e) }
    }

    revalidateTag('contrats')
    return NextResponse.json({ ok: true, workflow_statut: 'finalise' })
  }

  // ── Renvoyer à l'employé (à n'importe quelle étape) ──
  if (action === 'renvoyer_employe') {
    await admin.from('contrats').update({
      workflow_statut: 'envoye_employe',
      signe_employe_le: null,
    }).eq('id', id)

    const { error: notifRenvoiErr } = await admin.from('notifications').insert({
      user_id: contrat.profile_id,
      titre: 'Votre contrat a été mis à jour',
      message: `Le RH a modifié votre ${contrat.categorie_document ?? 'contrat'} (réf. ${ref}). Merci de le consulter et le signer à nouveau.`,
      lien: '/mes-contrats',
    })
    if (notifRenvoiErr) console.error('[contrat action] notif in-app renvoi employé:', notifRenvoiErr)

    if (profile?.email) {
      try {
        await sendEmail({
          to: profile.email,
          subject: `[My ABED] Contrat mis à jour — à signer`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Contrat mis à jour</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${profile.prenoms} ${profile.nom}</strong>,</p>
    <p style="font-size:14px;color:#374151;">
      Le RH a effectué des modifications sur votre ${contrat.categorie_document?.toLowerCase() ?? 'contrat'} (réf. <strong>${ref}</strong>).
      Merci de le consulter et de le signer à nouveau.
    </p>
    <a href="${APP_URL}/mes-contrats" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Voir et signer →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[contrat action] email renvoyer:', e) }
    }

    revalidateTag('contrats')
    return NextResponse.json({ ok: true, workflow_statut: 'envoye_employe' })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
