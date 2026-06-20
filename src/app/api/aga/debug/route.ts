import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.AGA_MODEL ?? 'gemini-1.5-flash-latest'

  if (!apiKey) {
    return NextResponse.json({ ok: false, problem: 'GEMINI_API_KEY absent dans les variables Vercel', model })
  }

  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Dis bonjour en une phrase.' }] }],
          generationConfig: { maxOutputTokens: 30 },
        }),
      }
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, problem: 'Erreur réseau vers Gemini', detail: e?.message, model })
  }

  const body = await res.text()
  if (res.ok) {
    const data = JSON.parse(body)
    return NextResponse.json({
      ok: true,
      model,
      key_prefix: apiKey.slice(0, 8) + '...',
      reply: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(vide)',
    })
  }

  return NextResponse.json({
    ok: false,
    http_status: res.status,
    model,
    key_prefix: apiKey.slice(0, 8) + '...',
    gemini_error: body.slice(0, 800),
    problem:
      res.status === 400 ? 'Requête invalide (modèle inconnu ?)' :
      res.status === 403 ? 'Clé API invalide ou accès refusé' :
      res.status === 429 ? 'Quota Gemini dépassé' :
      `Erreur Gemini HTTP ${res.status}`,
  })
}
