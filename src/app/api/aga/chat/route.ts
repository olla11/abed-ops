import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AGA_SYSTEM_PROMPT } from '@/lib/aga-knowledge'
import { loadKnowledgeFiles } from '@/lib/aga-files'

const MODEL = process.env.AGA_MODEL ?? 'llama-3.1-8b-instant'
const MAX_HISTORY = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AGA n'est pas encore configuré (clé API manquante)." }, { status: 503 })

  const body = await req.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  const filesContent = await loadKnowledgeFiles()
  const system = filesContent
    ? `${AGA_SYSTEM_PROMPT}\n\n# Documents internes (knowledge/)\n${filesContent}`
    : AGA_SYSTEM_PROMPT

  const trimmed = messages.slice(-MAX_HISTORY).map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '').slice(0, 4000),
  }))

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'system', content: system }, ...trimmed],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[aga/chat] groq error:', res.status, errText.slice(0, 500))
    const detail = res.status === 401 ? 'Clé API Groq invalide'
      : res.status === 429 ? 'Quota Groq dépassé — réessaie dans quelques secondes'
      : 'AGA est momentanément indisponible.'
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  const data = await res.json()
  const reply = data?.choices?.[0]?.message?.content ?? ''

  return NextResponse.json({ reply })
}
