import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { sendEmail } from '@/lib/resend'
import { signVerifyToken } from '@/app/api/auth/verify-email/route'
import { z } from 'zod'

const RegisterSchema = z.object({
  email:          s.email,
  password:       s.password,
  nom:            s.nom,
  prenoms:        s.prenoms,
  civilite:       z.string().max(10).optional(),
  telephone:      z.string().min(1, 'Téléphone requis').max(30),
  fonction:       z.string().min(1, 'Fonction requise').max(255),
  adresse:        z.string().min(1, 'Adresse requise').max(255),
  date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  lieu_naissance: z.string().min(1, 'Lieu de naissance requis').max(100),
  nationalite:    z.string().min(1, 'Nationalité requise').max(100),
  ifu:            z.string().min(1, 'Numéro IFU requis').max(20),
  grade_indice:   z.string().max(50).optional(),
})

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, window: 60 })
  if (limited) return limited

  const rawBody = await req.json().catch(() => null)
  const v = validate(RegisterSchema, rawBody)
  if ('error' in v) return v.error

  const { email, password, nom, prenoms, civilite, telephone, fonction,
    adresse, date_naissance, lieu_naissance, nationalite, ifu, grade_indice } = v.data

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  // If an unconfirmed account already exists with this email, delete it so the
  // user can re-register (e.g. after an expired confirmation link).
  {
    let page = 1
    outer: while (true) {
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (listErr || !users.length) break
      for (const u of users) {
        if (u.email === email) {
          if (!u.email_confirmed_at) await admin.auth.admin.deleteUser(u.id)
          break outer
        }
      }
      if (users.length < 1000) break
      page++
    }
  }

  // Create the user without email confirmation — we handle confirmation ourselves
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { nom, prenoms },
  })

  if (createError || !userData?.user) {
    const msg = createError?.message ?? 'Erreur création du compte'
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const userId = userData.user.id

  // Update profile with all registration fields
  await admin.from('profiles').update({
    nom, prenoms,
    civilite:        civilite       || 'M.',
    telephone:       telephone      || null,
    fonction:        fonction       || null,
    adresse:         adresse        || null,
    date_naissance:  date_naissance || null,
    lieu_naissance:  lieu_naissance || null,
    nationalite:     nationalite    || null,
    ifu:             ifu            || null,
    grade_indice:    grade_indice   || null,
    registration_status: 'pending_email',
    must_change_password: false,
  }).eq('id', userId)

  // Generate our own HMAC-signed verification token — valid 7 days, immune to scanner consumption
  const token = signVerifyToken(userId, email)
  const verifyLink = `${appUrl}/api/auth/verify-email?t=${token}`

  try {
    await sendEmail({
      to: email,
      subject: 'Confirmez votre adresse email — My ABED',
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

        <!-- Header -->
        <tr><td style="background:#16a34a;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:10px">
            <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="3"/>
          </svg>
          <span style="color:white;font-size:22px;font-weight:800;vertical-align:middle;letter-spacing:-0.5px">My ABED</span>
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0;letter-spacing:0.5px">PLATEFORME DE GESTION · ABED ONG</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:white;padding:36px 32px">

          <!-- Icon -->
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:16px;border:2px solid #bbf7d0">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
          </div>

          <p style="font-size:16px;color:#111827;margin:0 0 8px;font-weight:700">Bonjour ${civilite || 'M.'} ${prenoms} ${nom},</p>
          <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6">
            Merci de rejoindre <strong style="color:#111827">My ABED</strong>. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px">
            <a href="${verifyLink}" style="display:inline-block;background:#16a34a;color:white;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.2px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:8px;margin-bottom:2px">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Valider mon adresse email
            </a>
          </div>

          <!-- Info box -->
          <div style="background:#f9fafb;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p style="font-size:12px;color:#374151;margin:0;line-height:1.6">
                  Ce lien est valable <strong>7 jours</strong>. Après confirmation, votre compte sera examiné par un administrateur avant activation.<br>
                  Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.
                </p>
              </div>
            </div>
          </div>

          <p style="font-size:12px;color:#9ca3af;margin:0;word-break:break-all">
            Ou copiez ce lien dans votre navigateur :<br>
            <span style="color:#6b7280">${verifyLink}</span>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb">
          <div style="margin-bottom:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style="font-size:11px;color:#9ca3af">ABED ONG · Parakou, Bénin</span>
          </div>
          <p style="font-size:11px;color:#d1d5db;margin:0">© 2025 My ABED — Tous droits réservés</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })
  } catch (e) {
    console.error('[register] email error:', e)
  }

  return NextResponse.json({ ok: true })
}
