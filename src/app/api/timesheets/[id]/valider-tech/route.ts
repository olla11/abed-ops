import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { escapeHtml } from '@/lib/html'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'

const LOGO_DATA_URI = `data:image/png;base64,${LOGO_PNG_B64}`

// ── Templates email ──────────────────────────────────────────────────────────

function emailDirectValide({
  prenom, titre, heures, mois, annee, appUrl,
}: { prenom: string; titre: string; heures: number; mois: number; annee: number; appUrl: string }) {
  const lien = `${appUrl}/timesheets`
  return {
    subject: `✅ Timesheet validé — ${titre}`,
    html: `
<!DOCTYPE html><html lang="fr"><body style="margin:0;font-family:Arial,sans-serif;background:#f9fafb">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#2d6a4f;padding:24px 32px">
    <img src="${LOGO_DATA_URI}" alt="ABED" height="40" style="height:40px;display:block" />
    <h1 style="color:white;margin:12px 0 0;font-size:20px">Timesheet validé ✅</h1>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px">Bonjour <strong>${escapeHtml(prenom)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
      Votre responsable a <strong>validé techniquement</strong> votre timesheet :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:14px"><strong>${escapeHtml(titre)}</strong></p>
      <p style="margin:4px 0 0;font-size:13px;color:#4b5563">${heures}h retenues — ${mois}/${annee}</p>
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
      Vous pouvez maintenant <strong>soumettre votre demande de paiement</strong> pour recevoir votre règlement.
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${lien}" style="display:inline-block;background:#2d6a4f;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700">
        💳 Faire ma demande de paiement
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
      Cet email a été envoyé automatiquement par la plateforme My ABED.
    </p>
  </div>
</div>
</body></html>`,
  }
}

function emailCreditValide({
  prenom, titre, heures, mois, annee, appUrl,
}: { prenom: string; titre: string; heures: number; mois: number; annee: number; appUrl: string }) {
  const lien = `${appUrl}/timesheets`
  return {
    subject: `✅ Timesheet validé — compteur crédit mis à jour`,
    html: `
<!DOCTYPE html><html lang="fr"><body style="margin:0;font-family:Arial,sans-serif;background:#f9fafb">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#2d6a4f;padding:24px 32px">
    <img src="${LOGO_DATA_URI}" alt="ABED" height="40" style="height:40px;display:block" />
    <h1 style="color:white;margin:12px 0 0;font-size:20px">Timesheet validé ✅</h1>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px">Bonjour <strong>${escapeHtml(prenom)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
      Votre responsable a <strong>validé techniquement</strong> votre timesheet :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:14px"><strong>${escapeHtml(titre)}</strong></p>
      <p style="margin:4px 0 0;font-size:13px;color:#4b5563">${heures}h retenues — ${mois}/${annee}</p>
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">
      Votre <strong>compteur de crédit</strong> a été mis à jour. Vous pouvez consulter votre solde,
      le récapitulatif des heures validées et des versements reçus directement depuis la plateforme.
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${lien}" style="display:inline-block;background:#2d6a4f;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700">
        📊 Voir mon compteur crédit
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
      Cet email a été envoyé automatiquement par la plateforme My ABED.
    </p>
  </div>
</div>
</body></html>`,
  }
}

// ────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const body = await req.json()
  const { action, heures_retenues, justification_heures, commentaire_manager } = body

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, manager_id, titre, heures_declarees, status, periode_mois, periode_annee')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.manager_id !== user.id) return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  if (soum.status !== 'soumis') return NextResponse.json({ error: 'statut invalide' }, { status: 400 })

  if (action === 'valider') {
    if (!heures_retenues || heures_retenues <= 0) {
      return NextResponse.json({ error: 'Veuillez saisir les heures retenues.' }, { status: 400 })
    }
    if (heures_retenues < soum.heures_declarees && !justification_heures?.trim()) {
      return NextResponse.json({
        error: 'Les heures retenues sont inférieures aux heures déclarées. Veuillez justifier cet écart.',
        requiresJustification: true,
      }, { status: 422 })
    }

    // Récupérer le profil du prestataire (email + type_emploi)
    const { data: prestataire } = await supabase
      .from('profiles')
      .select('email, prenoms, nom, type_emploi')
      .eq('id', soum.prestataire_id).single()

    const estCredit = prestataire?.type_emploi === 'prestataire_credit'

    // Pour prestataire_credit : calculer montant et passer directement à valide_caf
    let montant_caf: number | null = null
    if (estCredit) {
      const { data: tauxRows } = await supabase
        .from('parametres').select('cle, valeur')
        .eq('cle', 'taux_horaire_credit_fcfa')
      const taux = Number(tauxRows?.[0]?.valeur ?? 1500)
      montant_caf = Math.round(heures_retenues * taux)
    }

    await supabase.from('soumissions').update({
      status: estCredit ? 'valide_caf' : 'valide_tech',
      heures_retenues,
      justification_heures: justification_heures || null,
      valide_par: user.id,
      valide_le: new Date().toISOString(),
      commentaire_manager: null,
      ...(estCredit ? {
        montant_caf,
        montant: montant_caf,
        caf_valide_le: new Date().toISOString(),
      } : {}),
    }).eq('id', id)

    // Notification in-app au prestataire
    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet validé techniquement',
      message: `${soum.titre} : ${heures_retenues}h retenues sur ${soum.heures_declarees}h déclarées.`,
      lien: '/timesheets',
    })

    // Notification in-app à un CAF
    const { data: caf } = await supabase
      .from('profiles').select('id').eq('role', 'caf').limit(1).single()
    if (caf) {
      await supabase.from('notifications').insert({
        user_id: caf.id,
        titre: 'Timesheet validé techniquement — à contrôler',
        message: `${soum.titre} — ${heures_retenues}h retenues. Vérifiez la facture.`,
        lien: '/timesheets',
      })
    }

    // ── Email au prestataire selon son type d'emploi ──
    if (prestataire?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
      const prenom = prestataire.prenoms ?? 'Madame/Monsieur'
      const typeEmploi = prestataire.type_emploi ?? ''

      try {
        const { subject, html } = typeEmploi === 'prestataire_direct'
          ? emailDirectValide({ prenom, titre: soum.titre, heures: heures_retenues, mois: soum.periode_mois, annee: soum.periode_annee, appUrl })
          : emailCreditValide({ prenom, titre: soum.titre, heures: heures_retenues, mois: soum.periode_mois, annee: soum.periode_annee, appUrl })

        await sendEmail({ to: prestataire.email, subject, html })
      } catch (e) {
        console.error('[valider-tech] email non envoyé :', e)
      }
    }

  } else {
    const newStatus = action === 'rejeter' ? 'rejete_tech' : 'corrections_tech'
    if (!commentaire_manager?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est obligatoire pour rejeter ou demander des corrections.' }, { status: 400 })
    }
    await supabase.from('soumissions').update({
      status: newStatus,
      commentaire_manager,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: action === 'rejeter' ? 'Timesheet rejeté' : 'Corrections demandées sur votre timesheet',
      message: `${soum.titre} — ${commentaire_manager}`,
      lien: '/timesheets',
    })
  }

  return NextResponse.json({ ok: true })
}
