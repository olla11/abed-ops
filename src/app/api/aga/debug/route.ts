import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const groqKey = process.env.GROQ_API_KEY
  const model = process.env.AGA_MODEL ?? 'llama-3.3-70b-versatile'

  if (!groqKey) {
    return NextResponse.json({ ok: false, problem: 'GROQ_API_KEY absent dans les variables Vercel', model })
  }

  let res: Response
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Dis bonjour.' }],
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, problem: 'Erreur réseau vers Groq', detail: e?.message, model })
  }

  const body = await res.text()
  if (res.ok) {
    const data = JSON.parse(body)
    return NextResponse.json({
      ok: true,
      model,
      key_prefix: groqKey.slice(0, 8) + '...',
      reply: data?.choices?.[0]?.message?.content ?? '(vide)',
    })
  }

  return NextResponse.json({
    ok: false,
    http_status: res.status,
    model,
    key_prefix: groqKey.slice(0, 8) + '...',
    groq_error: body.slice(0, 800),
    problem:
      res.status === 401 ? 'Clé API invalide ou expirée' :
      res.status === 400 ? 'Requête invalide — modèle inconnu ou clé mal formée' :
      res.status === 429 ? 'Quota Groq dépassé' :
      `Erreur Groq HTTP ${res.status}`,
  })
}
