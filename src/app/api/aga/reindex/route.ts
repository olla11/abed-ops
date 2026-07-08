import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { loadKnowledgeFilesRaw } from '@/lib/aga-files'
import { chunkText, embedText } from '@/lib/aga-embeddings'

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
    for (let i = 0; i < chunks.length; i++) {
      const result = await embedText(chunks[i], apiKey)
      if ('error' in result) {
        failedChunks++
        if (!firstError) firstError = result.error
        continue
      }
      const { error: insertErr } = await admin.from('aga_chunks').insert({
        source: file.name,
        chunk_index: i,
        content: chunks[i],
        embedding: result.embedding,
      })
      if (insertErr) {
        console.error('[aga/reindex] insert error:', insertErr)
        failedChunks++
        if (!firstError) firstError = insertErr.message
        continue
      }
      totalChunks++
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
