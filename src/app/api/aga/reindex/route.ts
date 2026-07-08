import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { loadKnowledgeFilesRaw } from '@/lib/aga-files'
import { chunkText, embedText } from '@/lib/aga-embeddings'

export const maxDuration = 300
const BATCH_SIZE = 3
const PAUSE_BETWEEN_BATCHES_MS = 800

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'rh'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'Accès réservé au RH/admin' }, { status: 403 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY manquante' }, { status: 503 })

  const admin = createAdminClient()
  const files = await loadKnowledgeFilesRaw()

  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier trouvé dans knowledge/' }, { status: 400 })
  }

  // Réindexation complète : on repart de zéro à chaque appel (base de connaissances de taille modeste)
  const { error: deleteErr } = await admin.from('aga_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  let totalChunks = 0
  let failedChunks = 0
  let firstError: string | null = null

  for (const file of files) {
    const chunks = chunkText(file.text)
    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
      const batch = chunks.slice(start, start + BATCH_SIZE)
      const results = await Promise.all(batch.map(chunk => embedText(chunk, apiKey)))

      const rows: { source: string; chunk_index: number; content: string; embedding: number[] }[] = []
      results.forEach((result, j) => {
        if ('error' in result) {
          failedChunks++
          if (!firstError) firstError = result.error
          return
        }
        rows.push({ source: file.name, chunk_index: start + j, content: batch[j], embedding: result.embedding })
      })

      if (rows.length > 0) {
        const { error: insertErr } = await admin.from('aga_chunks').insert(rows)
        if (insertErr) {
          console.error('[aga/reindex] insert error:', insertErr)
          failedChunks += rows.length
          if (!firstError) firstError = insertErr.message
        } else {
          totalChunks += rows.length
        }
      }

      if (start + BATCH_SIZE < chunks.length) await sleep(PAUSE_BETWEEN_BATCHES_MS)
    }
  }

  return NextResponse.json({
    ok: true,
    files: files.map(f => f.name),
    totalChunks,
    failedChunks,
    firstError,
  })
}
