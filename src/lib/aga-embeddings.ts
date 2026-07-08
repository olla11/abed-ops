// Utilitaires RAG pour AGA : découpage en chunks et vectorisation via l'API Gemini.

let cachedEmbeddingModel: string | null = null

// Le nom exact du modèle d'embedding disponible varie selon la clé/version d'API
// (ex. "text-embedding-004" peut ne plus exister) — on le découvre dynamiquement,
// comme pour le modèle de chat.
async function getEmbeddingModel(apiKey: string): Promise<string | null> {
  if (cachedEmbeddingModel) return cachedEmbeddingModel
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const j = await r.json()
    const models: string[] = (j?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('embedContent'))
      .map((m: any) => m.name as string)
    const pick = models.find(m => m.includes('embedding-001')) ?? models.find(m => m.includes('embedding')) ?? models[0] ?? null
    cachedEmbeddingModel = pick
    return pick
  } catch (e) {
    console.error('[aga-embeddings] getEmbeddingModel error:', e)
    return null
  }
}

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
  const model = await getEmbeddingModel(apiKey)
  if (!model) return { error: 'Aucun modèle Gemini supportant embedContent trouvé sur cette clé API.' }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          content: { parts: [{ text }] },
          outputDimensionality: 768,
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
