import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email:    s.email,
  password: s.password,
  nom:      s.nom,
  prenoms:  s.prenoms,
  role:     z.string().max(50).optional(),
  type_emploi: z.string().max(50).optional(),
  fonction:    s.shortText,
  telephone:   z.string().max(30).optional(),
  civilite:    z.string().max(10).optional(),
  ifu:         z.string().max(20).optional(),
  grade_indice:z.string().max(50).optional(),
  adresse:     z.string().max(255).optional(),
  date_naissance:  s.date,
  lieu_naissance:  z.string().max(100).optional(),
  nationalite:     z.string().max(100).optional(),
})

// POST /api/admin/create-user
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const rawBody = await req.json().catch(() => null)
  const v = validate(CreateUserSchema, rawBody)
  if ('error' in v) return v.error
  const { email, password, nom, prenoms, civilite, telephone, fonction,
    ifu, grade_indice, adresse, date_naissance, lieu_naissance, nationalite,
    role, type_emploi } = v.data

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, prenoms },
  })

  if (authError || !newUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Echec creation Auth' }, { status: 400 })
  }

  // UPDATE du profil cree par le trigger handle_new_user()
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      nom:                   nom,
      prenoms:               prenoms,
      civilite:              civilite       || 'M.',
      telephone:             telephone      || null,
      fonction:              fonction       || null,
      ifu:                   ifu            || null,
      grade_indice:          grade_indice   || null,
      adresse:               adresse        || null,
      date_naissance:        date_naissance || null,
      lieu_naissance:        lieu_naissance || null,
      nationalite:           nationalite    || null,
      must_change_password:  true,
      role:                  role            || 'missionnaire',
      type_emploi:           type_emploi     || null,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json(
      { error: 'Compte cree mais profil incomplet : ' + profileError.message },
      { status: 207 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  let emailSent = false
  let emailError = ''

  try {
    await sendEmail({
      to: email,
      subject: 'Bienvenue sur My ABED — Vos identifiants de connexion',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#16a34a;font-size:22px;margin:12px 0 4px">My ABED</h1>
            <p style="color:#6b7280;font-size:13px;margin:0">Plateforme de gestion ABED ONG</p>
          </div>
          <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #e5e7eb">
            <p style="font-size:15px;color:#111827;margin:0 0 16px">Bonjour <strong>${civilite || 'M.'} ${prenoms} ${nom}</strong>,</p>
            <p style="font-size:14px;color:#374151;margin:0 0 20px">
              Votre compte a été créé sur la plateforme <strong>My ABED</strong>. Voici vos identifiants de connexion :
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Email</p>
              <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827">${email}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Mot de passe provisoire</p>
              <p style="margin:0;font-size:18px;font-weight:800;color:#16a34a;letter-spacing:2px">${password}</p>
            </div>
            <p style="font-size:13px;color:#f59e0b;margin:0 0 20px">
              ⚠️ Vous serez invité(e) à changer ce mot de passe lors de votre première connexion.
            </p>
            <a href="${appUrl}/login" style="display:block;text-align:center;background:#16a34a;color:white;padding:12px 0;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none">
              Se connecter →
            </a>
          </div>
          <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">
            My ABED — ABED ONG · Parakou, Bénin
          </p>
        </div>
      `,
    })
    emailSent = true
  } catch (e: any) {
    emailError = e?.message ?? 'Erreur inconnue'
    console.error('[create-user] email error:', emailError)
  }

  return NextResponse.json({ ok: true, userId: newUser.user.id, emailSent, emailError: emailSent ? undefined : emailError })
}