import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AGA_SYSTEM_PROMPT } from '@/lib/aga-knowledge'

const MODEL = process.env.AGA_MODEL ?? 'claude-sonnet-4-6'
const MAX_HISTORY = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AGA n'est pas encore configuré (clé API manquante)." }, { status: 503 })

  const body = await req.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  const trimmed = messages.slice(-MAX_HISTORY).map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '').slice(0, 4000),
  }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: AGA_SYSTEM_PROMPT,
      messages: trimmed,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[aga/chat] anthropic error:', res.status, errText)
    return NextResponse.json({ error: 'AGA est momentanément indisponible.' }, { status: 502 })
  }

  const data = await res.json()
  const reply = data?.content?.find((b: any) => b.type === 'text')?.text ?? ''

  return NextResponse.json({ reply })
}
