import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ gemini_key: 'ABSENT', groq_key: !!process.env.GROQ_API_KEY })

  const model = process.env.AGA_MODEL ?? 'gemini-1.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Dis bonjour en une phrase.' }] }],
        generationConfig: { maxOutputTokens: 50 },
      }),
    }
  )

  const body = await res.text()
  return NextResponse.json({
    status: res.status,
    ok: res.ok,
    model,
    key_prefix: apiKey.slice(0, 8) + '...',
    response: body.slice(0, 600),
  })
}
