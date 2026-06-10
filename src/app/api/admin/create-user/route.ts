import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { escapeHtml } from '@/lib/html'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'

const LOGO_DATA_URI = `data:image/png;base64,${LOGO_PNG_B64}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const body = await req.json()
  const {
    email, nom, prenoms, civilite, telephone, fonction,
    ifu, grade_indice, adresse, date_naissance, lieu_naissance, nationalite,
  } = body

  if (!email || !nom || !prenoms) {
    return NextResponse.json({ error: 'Champs requis : email, nom, prenoms' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Mot de passe aléatoire jamais divulgué : l'utilisateur définira le sien
  // via le lien d'invitation sécurisé envoyé par email.
  const motDePasseProvisoire = crypto.randomUUID() + 'Aa1!'

  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: motDePasseProvisoire,
    email_confirm: true,
    user_metadata: { nom, prenoms },
  })

  if (authError || !newUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Echec creation Auth' }, { status: 400 })
  }

  // UPDATE du profil créé par le trigger handle_new_user()
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      nom,
      prenoms,
      civilite:       civilite       || 'M.',
      telephone:      telephone      || null,
      fonction:       fonction       || null,
      ifu:            ifu            || null,
      grade_indice:   grade_indice   || null,
      adresse:        adresse        || null,
      date_naissance: date_naissance || null,
      lieu_naissance: lieu_naissance || null,
      nationalite:    nationalite    || null,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json(
      { error: 'Compte créé mais profil incomplet : ' + profileError.message },
      { status: 207 }
    )
  }

  // Email d'invitation : lien sécurisé pour définir soi-même son mot de passe.
  // Aucun mot de passe ne transite jamais en clair par email.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    const tokenHash = linkData?.properties?.hashed_token
    const actionLink = tokenHash
      ? `${appUrl}/auth/definir-mot-de-passe?token_hash=${tokenHash}&type=recovery`
      : `${appUrl}/login`
    await sendEmail({
      to: email,
      subject: `Bienvenue sur My ABED — Activez votre compte`,
      html: buildWelcomeEmail({ prenoms, nom, email, actionLink }),
    })
  } catch (e) {
    console.error('[create-user] email bienvenue non envoyé :', e)
  }

  return NextResponse.json({ ok: true, userId: newUser.user.id })
}

function buildWelcomeEmail({ prenoms, nom, email, actionLink }: {
  prenoms: string; nom: string; email: string; actionLink: string
}) {
  const safePrenoms = escapeHtml(prenoms)
  const safeNom = escapeHtml(nom)
  const safeEmail = escapeHtml(email)
  return `
<!DOCTYPE html><html lang="fr"><body style="margin:0;font-family:Arial,sans-serif;background:#f9fafb">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#2d6a4f;padding:24px 32px">
    <img src="${LOGO_DATA_URI}" alt="ABED" height="40" style="height:40px;display:block" />
    <h1 style="color:white;margin:12px 0 0;font-size:20px">Bienvenue sur My ABED 👋</h1>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;font-size:15px">Bonjour <strong>${safePrenoms} ${safeNom}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">
      Votre compte sur la plateforme <strong>My ABED</strong> a été créé par l'administration.
      Pour l'activer, définissez votre mot de passe personnel en cliquant sur le bouton ci-dessous.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534">Votre identifiant de connexion</p>
      <table style="width:100%;font-size:13px;color:#374151">
        <tr>
          <td style="padding:4px 0;width:120px;color:#6b7280">Email</td>
          <td style="font-weight:600">${safeEmail}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:28px">
      <a href="${actionLink}" style="display:inline-block;background:#2d6a4f;color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700">
        Définir mon mot de passe →
      </a>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#92660b;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;line-height:1.6">
      🔒 <strong>Sécurité :</strong> ce lien est personnel et valable un temps limité.
      Si le bouton a expiré, demandez une nouvelle invitation à l'administration.
    </p>

    <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;line-height:1.6">
      Si vous n'êtes pas concerné par ce message, contactez l'administration ABED.<br/>
      Cet email a été envoyé automatiquement par la plateforme My ABED.
    </p>
  </div>
</div>
</body></html>`
}
