export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
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
      html,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`[Resend] Erreur ${res.status}: ${txt}`)
  }
}
