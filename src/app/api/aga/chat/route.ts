import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AGA_SYSTEM_PROMPT } from '@/lib/aga-knowledge'
import { loadKnowledgeFiles } from '@/lib/aga-files'

const MODEL = process.env.AGA_MODEL ?? 'gemini-1.5-flash'
const MAX_HISTORY = 20

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AGA n'est pas encore configuré (clé API manquante)." }, { status: 503 })

  const body = await req.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  const trimmed = messages.slice(-MAX_HISTORY).map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '').slice(0, 4000) }],
  }))

  const filesContent = await loadKnowledgeFiles()
  const system = filesContent
    ? `${AGA_SYSTEM_PROMPT}\n\n# Documents internes (knowledge/)\n${filesContent}`
    : AGA_SYSTEM_PROMPT

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: trimmed,
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[aga/chat] gemini error:', res.status, errText.slice(0, 500))
    const detail = res.status === 400 ? 'Requête invalide'
      : res.status === 401 || res.status === 403 ? 'Clé API invalide ou non autorisée'
      : res.status === 429 ? 'Quota dépassé — réessaie dans quelques secondes'
      : 'AGA est momentanément indisponible.'
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  const data = await res.json()
  const reply = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? ''

  return NextResponse.json({ reply })
}
