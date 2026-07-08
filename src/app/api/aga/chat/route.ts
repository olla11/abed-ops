import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { AGA_SYSTEM_PROMPT } from '@/lib/aga-knowledge'
import { loadKnowledgeFiles } from '@/lib/aga-files'
import { embedText } from '@/lib/aga-embeddings'

// RAG : ne récupère que les passages pertinents pour la dernière question, au lieu
// d'injecter tout le contenu de knowledge/ à chaque requête. Repli sur l'ancien
// comportement (injection brute) si la base vectorielle n'est pas encore indexée.
async function getRelevantContext(question: string, apiKey: string): Promise<string | null> {
  const embedding = await embedText(question, apiKey)
  if (!embedding) return null

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('match_aga_chunks', { query_embedding: embedding, match_count: 6 })
  if (error) {
    console.error('[aga/chat] match_aga_chunks error:', error)
    return null
  }
  const rows = (data ?? []) as { source: string; content: string; similarity: number }[]
  const relevant = rows.filter(r => r.similarity > 0.3)
  if (relevant.length === 0) return null

  return relevant.map(r => `## ${r.source}\n${r.content}`).join('\n\n')
}

const MAX_HISTORY = 20

let cachedModel: string | null = null

async function getModel(apiKey: string): Promise<string | null> {
  if (process.env.AGA_MODEL) return process.env.AGA_MODEL
  if (cachedModel) return cachedModel
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const j = await r.json()
    const models: string[] = (j?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => m.name as string)
    const pick = models.find(m => m.includes('flash')) ?? models[0] ?? null
    cachedModel = pick
    return pick
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no_key' }, { status: 503 })

  const model = await getModel(apiKey)
  if (!model) return NextResponse.json({ error: 'no_model', groqMsg: 'Aucun modèle Gemini disponible sur cette clé API.' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 })
  }

  const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
  let docContext = lastUserMessage ? await getRelevantContext(String(lastUserMessage), apiKey) : null

  // Repli : base vectorielle pas encore indexée (ou recherche indisponible) → ancien comportement
  if (docContext === null) {
    docContext = await loadKnowledgeFiles()
  }

  const systemInstruction = docContext
    ? `${AGA_SYSTEM_PROMPT}\n\n# Documents internes (knowledge/)\n${docContext}`
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
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
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
