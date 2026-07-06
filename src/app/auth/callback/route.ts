import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/accueil'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // After email confirmation, move registration_status pending_email → pending_activation
    if (data?.user && next.includes('email-confirmed')) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ registration_status: 'pending_activation' })
        .eq('id', data.user.id)
        .eq('registration_status', 'pending_email')
        .select('nom, prenoms, email')
        .single()

      if (updated) {
        const admin = createAdminClient()
        const { data: admins } = await admin
          .from('profiles').select('id, email, prenoms').eq('role', 'admin')

        const nomComplet = `${updated.prenoms ?? ''} ${updated.nom ?? ''}`.trim() || updated.email || 'Nouvel utilisateur'
        const lienActivation = `${appUrl}/admin/inscriptions`

        // Notification in-app + email à chaque admin
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
              console.error('[Email] Échec notification admin nouveau compte:', e)
            }
          }
        }
      }
    }
  }

  return NextResponse.redirect(`${appUrl}${next}`)
}
