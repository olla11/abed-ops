import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, fonction, titre').eq('id', user.id).single()

  if (!profile) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  // Trois personnes peuvent signer un OM : le DE, le CAF, le Président du CA.
  //   - Cas général : seul le DE signe.
  //   - OM du DE lui-même (il ne peut pas s'auto-signer) : seuls le CAF
  //     (mention "Pour Ordre") ou le Président du CA peuvent signer. Le
  //     Président se distingue par son `titre` — l'AccessRole
  //     'administrateur' seul est partagé avec les autres membres du CA
  //     (secrétaire général, trésorier), qui eux ne signent jamais.
  const { data: missionCheck } = await supabase
    .from('missions')
    .select('missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey(role)')
    .eq('id', id)
    .single()

  if (!missionCheck) {
    return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  }

  const missionnaireEstDE = (missionCheck.missionnaire as any)?.role === 'de'
  const estPresidentCA = profile.role === 'administrateur' && profile.titre === 'president_ca'
  const signePourOrdre = missionnaireEstDE && profile.role === 'caf'

  const eligible = missionnaireEstDE
    ? profile.role === 'caf' || estPresidentCA
    : profile.role === 'de'

  if (!eligible) {
    return NextResponse.json({
      error: missionnaireEstDE
        ? "Cet OM appartient au Directeur Exécutif, qui ne peut pas le signer lui-même : seuls le CAF (Pour Ordre) ou le Président du CA peuvent le signer."
        : 'Seul le Directeur Exécutif peut signer cet ordre de mission.',
    }, { status: 403 })
  }

  // Garde-fou : personne ne signe son propre OM
  if (missionCheck.missionnaire_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas signer votre propre ordre de mission.' }, { status: 403 })
  }

  const now = new Date()
  const year2 = String(now.getFullYear()).slice(-2)

  // Trouver le numéro de séquence max déjà utilisé pour cette année
  const { data: existingRefs } = await supabase
    .from('missions')
    .select('reference')
    .like('reference', `%-${year2}/ABED/DE/CAF/AAF`)

  const maxSeq = (existingRefs ?? []).reduce((max, r) => {
    const m = r.reference?.match(/^(\d+)-/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const reference = `${String(maxSeq + 1).padStart(3, '0')}-${year2}/ABED/DE/CAF/AAF`

  const { error } = await supabase
    .from('missions')
    .update({ status: 'signe', reference, signe_par: user.id, signe_le: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['soumis', 'brouillon'])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: mission } = await supabase
    .from('missions')
    .select('missionnaire_id, objet, date_depart, date_retour, lieu, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, email, civilite)')
    .eq('id', id).single()

  if (mission) {
    // Notif in-app
    await supabase.from('notifications').insert({
      user_id: mission.missionnaire_id,
      titre: 'Ordre de Mission signé',
      message: `Votre OM "${mission.objet}" (réf. ${reference}) est signé et disponible au téléchargement.`,
      lien: `/missions/${id}`,
    })

    // Email au missionnaire
    const m = mission.missionnaire as any
    const signedBy = `${profile.prenoms} ${profile.nom}${profile.fonction ? ` — ${profile.fonction}` : ''}${signePourOrdre ? ' (Pour Ordre)' : ''}`
    if (m?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
      try {
        await sendEmail({
          to: m.email,
          subject: `✅ Votre Ordre de Mission est signé — Réf. ${reference}`,
          html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="background:#16a34a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center">
          <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px">My ABED</span>
          <p style="color:rgba(255,255,255,0.8);font-size:11px;margin:4px 0 0;letter-spacing:0.5px">PLATEFORME DE GESTION · ABED ONG</p>
        </td></tr>
        <tr><td style="background:white;padding:36px 32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:16px;border:2px solid #bbf7d0">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
          <p style="font-size:16px;color:#111827;margin:0 0 8px;font-weight:700">Bonjour ${m.civilite || ''} ${m.prenoms} ${m.nom},</p>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
            Votre ordre de mission a été <strong style="color:#16a34a">signé</strong>. Vous pouvez dès maintenant le télécharger depuis votre espace My ABED.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px">RÉFÉRENCE</td>
                  <td style="font-size:14px;font-weight:700;color:#111827;text-align:right">${reference}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px">OBJET</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${mission.objet}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px">LIEU</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${mission.lieu ?? '—'}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280">PÉRIODE</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${mission.date_depart ?? '—'} → ${mission.date_retour ?? '—'}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280">SIGNÉ PAR</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${signedBy}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px">
            <a href="${appUrl}/missions/${id}" style="display:inline-block;background:#16a34a;color:white;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
              Voir mon ordre de mission
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0">Cet email a été envoyé automatiquement par My ABED. Ne pas répondre à cet email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="font-size:11px;color:#d1d5db;margin:0">© 2025 My ABED — ABED ONG · Parakou, Quartier Zongo, Bénin</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        })
      } catch (e) {
        console.error('[signer] email error:', e)
      }
    }

    // Le DP, le CAF et les membres du CA (Président compris) sont informés
    // qu'un OM a été signé pour quelqu'un — simple information, in-app et
    // email, même s'ils n'ont pas signé cet OM. On exclut le signataire
    // lui-même et le missionnaire (déjà notifiés ci-dessus).
    const { data: informes } = await supabase
      .from('profiles')
      .select('id, email, nom, prenoms')
      .or('role.eq.dp,role.eq.caf,titre.in.(president_ca,secretaire_general_ca,tresorier_ca)')

    const nomMissionnaire = `${m?.prenoms ?? ''} ${m?.nom ?? ''}`.trim()
    const appUrlInfo = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
    for (const inf of informes ?? []) {
      if (inf.id === user.id || inf.id === mission.missionnaire_id) continue

      await supabase.from('notifications').insert({
        user_id: inf.id,
        titre: 'Ordre de Mission signé',
        message: `L'OM de ${nomMissionnaire} (réf. ${reference}) a été signé par ${signedBy}. Pour information.`,
        lien: `/missions/${id}`,
      })

      if (inf.email) {
        try {
          await sendEmail({
            to: inf.email,
            subject: `ℹ️ OM signé — ${nomMissionnaire} (Réf. ${reference})`,
            html: `<!DOCTYPE html>
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
          <p style="font-size:16px;color:#111827;margin:0 0 8px;font-weight:700">Bonjour ${inf.prenoms ?? ''} ${inf.nom ?? ''},</p>
          <p style="font-size:13px;color:#9ca3af;margin:0 0 20px;font-style:italic">Pour information — aucune action requise de votre part.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px">RÉFÉRENCE</td>
                  <td style="font-size:14px;font-weight:700;color:#111827;text-align:right">${reference}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px">MISSIONNAIRE</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${nomMissionnaire}</td></tr>
              <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0"></td></tr>
              <tr><td style="font-size:12px;color:#6b7280">SIGNÉ PAR</td>
                  <td style="font-size:13px;color:#374151;text-align:right">${signedBy}</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px">
            <a href="${appUrlInfo}/missions/${id}" style="display:inline-block;background:#63a521;color:white;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
              Voir l'ordre de mission
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0">Cet email a été envoyé automatiquement par My ABED. Ne pas répondre à cet email.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="font-size:11px;color:#d1d5db;margin:0">© 2025 My ABED — ABED ONG · Parakou, Quartier Zongo, Bénin</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
          })
        } catch (e) {
          console.error('[signer] email info error:', e)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, reference })
}