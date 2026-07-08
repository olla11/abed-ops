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

export async function embedText(text: string, apiKey: string): Promise<number[] | null> {
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
      console.error('[aga-embeddings] embedContent error:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    const values = data?.embedding?.values
    return Array.isArray(values) ? values : null
  } catch (e) {
    console.error('[aga-embeddings] network error:', e)
    return null
  }
}
