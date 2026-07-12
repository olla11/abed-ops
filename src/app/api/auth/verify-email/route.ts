import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import crypto from 'crypto'

function getSecret() {
  return process.env.EMAIL_VERIFY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
}

export function signVerifyToken(userId: string, email: string): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  const payload = `${userId}|${email}|${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 4) return null
    const [userId, email, expiresAtStr, sig] = parts
    const payload = `${userId}|${email}|${expiresAtStr}`
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    // timingSafeEqual requires equal-length buffers — guard against tampered tokens
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
    if (Date.now() > parseInt(expiresAtStr)) return null
    return { userId, email }
  } catch {
    return null
  }
}

function html(title: string, body: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — My ABED</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;min-height:100vh;display:grid;place-items:center;padding:24px}
    .card{background:white;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.10);padding:40px 36px;max-width:480px;width:100%;text-align:center}
    .btn{display:inline-block;background:#16a34a;color:white;padding:12px 32px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;margin-top:24px}
    .btn-outline{display:inline-block;border:1px solid #d1d5db;color:#374151;padding:10px 24px;border-radius:10px;font-size:13px;text-decoration:none;margin-top:12px}
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')

  if (!token) {
    return html('Lien invalide', `
      <div style="font-size:52px;margin-bottom:16px">⚠️</div>
      <h2 style="color:#991b1b;font-size:20px;font-weight:800;margin-bottom:12px">Lien invalide</h2>
      <p style="font-size:14px;color:#6b7280;margin-bottom:0">Ce lien de confirmation est incomplet ou invalide.</p>
      <a href="/auth/inscription" class="btn">Créer un nouveau compte</a><br>
      <a href="/login" class="btn-outline">Retour à la connexion</a>
    `)
  }

  const payload = verifyToken(token)
  if (!payload) {
    return html('Lien expiré', `
      <div style="font-size:52px;margin-bottom:16px">⏰</div>
      <h2 style="color:#92400e;font-size:20px;font-weight:800;margin-bottom:12px">Lien expiré ou déjà utilisé</h2>
      <p style="font-size:14px;color:#6b7280;margin-bottom:0">Ce lien de confirmation n'est plus valide. Inscrivez-vous à nouveau pour en recevoir un nouveau.</p>
      <a href="/auth/inscription" class="btn">Créer un nouveau compte</a><br>
      <a href="/login" class="btn-outline">Retour à la connexion</a>
    `)
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Confirm the user's email in Supabase
  const { error } = await admin.auth.admin.updateUserById(payload.userId, {
    email_confirm: true,
  })

  if (error) {
    console.error('[verify-email] updateUserById error:', error.message)
    return html('Erreur de confirmation', `
      <div style="font-size:52px;margin-bottom:16px">❌</div>
      <h2 style="color:#991b1b;font-size:20px;font-weight:800;margin-bottom:12px">Erreur de confirmation</h2>
      <p style="font-size:14px;color:#6b7280;margin-bottom:0">Une erreur technique est survenue : ${error.message}</p>
      <a href="/auth/inscription" class="btn">Créer un nouveau compte</a><br>
      <a href="/login" class="btn-outline">Retour à la connexion</a>
    `)
  }

  // Update profile status (pending_email → pending_activation)
  const { data: updated } = await admin
    .from('profiles')
    .update({ registration_status: 'pending_activation' })
    .eq('id', payload.userId)
    .eq('registration_status', 'pending_email')
    .select('nom, prenoms, email')
    .single()

  // Notifie chaque admin/RH (in-app + email) qu'un nouveau compte attend l'activation
  if (updated) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
    const nomComplet = `${updated.prenoms ?? ''} ${updated.nom ?? ''}`.trim() || updated.email || 'Nouvel utilisateur'
    const lienActivation = `${appUrl}/admin/inscriptions`

    const { data: admins } = await admin
      .from('profiles')
      .select('id, email, prenoms')
      .in('role', ['admin', 'rh'])
      .eq('archived', false)

    for (const a of admins ?? []) {
      await admin.from('notifications').insert({
        user_id: a.id,
        titre: 'Nouveau compte à activer',
        message: `${nomComplet} a confirmé son email et attend l'activation de son compte.`,
        lien: '/admin/inscriptions',
      })

      if (a.email) {
        try {
          await sendEmail({
            to: a.email,
            subject: `[My ABED] Nouveau compte à activer — ${nomComplet}`,
            html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">My ABED — Nouveau compte à activer</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:14px;">Bonjour <strong>${a.prenoms ?? 'Administrateur'}</strong>,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
      Un nouvel utilisateur vient de confirmer son adresse email et attend l'activation de son compte :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:15px;font-weight:700;color:#166534;">${nomComplet}</p>
      ${updated.email ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${updated.email}</p>` : ''}
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${lienActivation}"
         style="display:inline-block;background:#064e3b;color:white;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">
        Activer le compte →
      </a>
    </div>
    <p style="font-size:12px;color:#9ca3af;margin:0;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
          })
        } catch (e) {
          console.error('[verify-email] échec email notification admin:', e)
        }
      }
    }
  }

  return html('Email confirmé !', `
    <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:20px;border:3px solid #bbf7d0;margin-bottom:20px">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h2 style="color:#166534;font-size:22px;font-weight:800;margin-bottom:16px">Email confirmé !</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:16px;text-align:left">
      <p style="font-size:14px;color:#166534;font-weight:700;margin-bottom:8px">✅ Votre email est bien validé</p>
      <p style="font-size:13px;color:#374151">
        Votre compte est en attente d'activation par l'administrateur système.<br><br>
        Vous recevrez un email dès que votre accès sera configuré.
      </p>
    </div>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:0;text-align:left">
      <p style="font-size:13px;color:#92400e">
        💡 Contactez l'administrateur système directement pour accélérer l'activation de votre compte.
      </p>
    </div>
    <a href="/login" class="btn">Retour à la connexion</a>
  `)
}

