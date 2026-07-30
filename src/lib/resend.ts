// Pied de page légal, ajouté automatiquement à tous les emails envoyés par
// l'application (voir sendEmail ci-dessous) — un seul endroit à maintenir.
// L'année s'actualise toute seule chaque année (pas de valeur en dur).
function disclaimerEmail(): string {
  const annee = new Date().getFullYear()
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="font-size:8px;line-height:1.5;color:#9ca3af;margin:0;">
        Ce message a été envoyé automatiquement par My ABED, la plateforme de gestion d'ABED-ONG.
        Merci de ne pas y répondre directement. Pour toute question, contactez
        <a href="mailto:contact@abedong.org" style="color:#9ca3af;">contact@abedong.org</a>.<br>
        © ${annee} ABED-ONG — Agriculture pour le Bien-être et le Développement Durable. Tous droits réservés.
      </p>
    </div>
  `
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string | string[]
  subject: string
  html: string
  // Pièces jointes (ex. document PDF signé) — content en base64, sans le préfixe data URI.
  attachments?: { filename: string; content: string }[]
}) {
  const apiKey = process.env.RESEND_API_KEY
  // Resend free plan: only verified domains work. Use onboarding@resend.dev as safe fallback
  // (can only send to the Resend account owner's email on free plan with this sender)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'My ABED <onboarding@resend.dev>'

  if (!apiKey) {
    console.warn('[Resend] RESEND_API_KEY non défini — email non envoyé')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: `${html}${disclaimerEmail()}`,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      // Disable link tracking so Resend does not pre-fetch OTP links before the user clicks
      tags: [{ name: 'track_clicks', value: 'false' }],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`[Resend] Erreur ${res.status}: ${txt}`)
  }
}
