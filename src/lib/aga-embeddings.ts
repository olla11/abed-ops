// Utilitaires RAG pour AGA : découpage en chunks et vectorisation via l'API Gemini.

const EMBEDDING_MODEL = 'models/text-embedding-004'

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const clean = text.trim()
  if (!clean) return []
  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length)
    const chunk = clean.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= clean.length) break
    start = end - overlap
  }
  return chunks
}

export type EmbedResult = { embedding: number[] } | { error: string }

export async function embedText(text: string, apiKey: string): Promise<EmbedResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          content: { parts: [{ text }] },
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[aga-embeddings] embedContent error:', res.status, body)
      return { error: `HTTP ${res.status} — ${body.slice(0, 300)}` }
    }
    const data = await res.json()
    const values = data?.embedding?.values
    if (!Array.isArray(values)) return { error: `Réponse inattendue: ${JSON.stringify(data).slice(0, 300)}` }
    return { embedding: values }
  } catch (e) {
    console.error('[aga-embeddings] network error:', e)
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
