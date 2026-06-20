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
  if (!apiKey) return NextResponse.json({ error: 'no_key' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  const filesContent = await loadKnowledgeFiles()
  const systemInstruction = filesContent
    ? `${AGA_SYSTEM_PROMPT}\n\n# Documents internes (knowledge/)\n${filesContent}`
    : AGA_SYSTEM_PROMPT

  // Gemini format: contents array with alternating user/model roles
  const trimmed = messages.slice(-MAX_HISTORY)
  const contents = trimmed.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '') }],
  }))

  // Gemini requires conversation to start with 'user'
  while (contents.length > 0 && contents[0].role !== 'user') contents.shift()

  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    )
  } catch (e) {
    console.error('[aga/chat] network error reaching gemini:', e)
    return NextResponse.json({ error: 'network' }, { status: 502 })
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[aga/chat] gemini error:', res.status, errText.slice(0, 500))
    let groqMsg = ''
    try { groqMsg = JSON.parse(errText)?.error?.message ?? '' } catch {}
    const code =
      res.status === 400 ? 'invalid_key' :
      res.status === 401 ? 'invalid_key' :
      res.status === 403 ? 'invalid_key' :
      res.status === 429 ? 'rate_limit' :
      res.status >= 500  ? 'service_unavailable' :
      'unknown'
    return NextResponse.json({ error: code, httpStatus: res.status, groqMsg }, { status: 502 })
  }

  const data = await res.json()
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  return NextResponse.json({ reply })
}
