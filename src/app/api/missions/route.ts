import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { status, ...fields } = body

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({ ...fields, missionnaire_id: user.id, status })
    .select()
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: error?.message ?? 'Erreur création' }, { status: 400 })
  }

  // Notifier les signataires uniquement si soumis (pas brouillon)
  if (status === 'soumis') {
    const { data: missProfile } = await supabase
      .from('profiles').select('nom, prenoms, civilite').eq('id', user.id).single()

    const missNom = `${missProfile?.prenoms ?? ''} ${missProfile?.nom ?? ''}`.trim()
    const admin = createAdminClient()

    // Récupérer DE, CAF et administrateur (président CA)
    const { data: signataires } = await admin
      .from('profiles')
      .select('id, email, nom, prenoms, role')
      .in('role', ['de', 'caf', 'administrateur'])

    for (const s of signataires ?? []) {
      // Notif in-app
      await admin.from('notifications').insert({
        user_id: s.id,
        titre: 'Nouvel OM à signer',
        message: `${missNom} a soumis un ordre de mission : « ${mission.objet} » (${mission.lieu}). Veuillez examiner et signer.`,
        lien: `/missions/${mission.id}`,
      })

      // Email
      if (s.email) {
        try {
          await sendEmail({
            to: s.email,
            subject: `📋 Nouvel Ordre de Mission à signer — ${missNom}`,
            html: buildEmailHtml(mission, missNom, s),
          })
        } catch (e) {
          console.error('[missions/create] email error:', e)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, id: mission.id })
}

function buildEmailHtml(mission: any, missNom: string, signataire: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const roleLabel: Record<string, string> = {
    de: 'Directeur Exécutif',
    caf: 'CAF',
    administrateur: 'Président du Conseil d\'Administration',
  }
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="background:#63a521;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center">
          <span style="color:white;font-size:20px;font-weight:800">My ABED</span>
          <p style="color:rgba(255,255,255,0.8);font-size:11px;margin:5px 0 0;letter-spacing:0.5px">PLATEFORME DE GESTION · ABED ONG</p>
        </td></tr>
        <tr><td style="background:white;padding:36px 32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;background:#fef3c7;border-radius:50%;padding:16px;border:2px solid #fde68a">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </div>
          <p style="font-size:16px;color:#111827;margin:0 0 6px;font-weight:700">
            Bonjour ${signataire.prenoms ?? ''} ${signataire.nom ?? ''},
          </p>
          <p style="font-size:13px;color:#6b7280;margin:0 0 4px">
            ${roleLabel[signataire.role] ?? signataire.role}
          </p>
          <p style="font-size:14px;color:#374151;margin:16px 0 24px;line-height:1.6">
            Un nouvel <strong>Ordre de Mission</strong> a été soumis par <strong>${missNom}</strong> et nécessite votre signature.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#6b7280;padding-bottom:6px">OBJET</td>
                <td style="font-size:14px;font-weight:700;color:#111827;text-align:right">${mission.objet}</td>
              </tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr>
                <td style="font-size:12px;color:#6b7280;padding-bottom:6px">LIEU</td>
                <td style="font-size:13px;color:#374151;text-align:right">${mission.lieu ?? '—'}</td>
              </tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr>
                <td style="font-size:12px;color:#6b7280;padding-bottom:6px">PÉRIODE</td>
                <td style="font-size:13px;color:#374151;text-align:right">${mission.date_depart ?? '—'} → ${mission.date_retour ?? '—'}</td>
              </tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr>
                <td style="font-size:12px;color:#6b7280">MISSIONNAIRE</td>
                <td style="font-size:13px;color:#374151;text-align:right">${missNom}</td>
              </tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px">
            <a href="${appUrl}/missions/${mission.id}" style="display:inline-block;background:#63a521;color:white;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
              ✍️ Voir et signer l'OM
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0">Cet email a été envoyé automatiquement par My ABED.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="font-size:11px;color:#d1d5db;margin:0">© 2025 My ABED — ABED ONG · Parakou, Bénin</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
