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
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'ABED-ONG <noreply@abedong.org>'

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
