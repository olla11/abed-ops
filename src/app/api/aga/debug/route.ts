import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, problem: 'GEMINI_API_KEY absent' })

  // Liste les modèles disponibles sur cette clé
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  ).catch((e: any) => ({ ok: false, error: e?.message }))

  if (!('json' in listRes)) {
    return NextResponse.json({ ok: false, problem: 'Erreur réseau', detail: (listRes as any).error })
  }

  const listBody = await (listRes as Response).json()
  const models: string[] = (listBody?.models ?? [])
    .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m: any) => m.name)

  // Teste le premier modèle flash disponible
  const flashModel = models.find(m => m.includes('flash')) ?? models[0]

  if (!flashModel) {
    return NextResponse.json({ ok: false, problem: 'Aucun modèle generateContent disponible', all: listBody?.models?.map((m:any)=>m.name) })
  }

  const testRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${flashModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Dis bonjour.' }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    }
  )

  const testBody = await testRes.json()
  const reply = testBody?.candidates?.[0]?.content?.parts?.[0]?.text ?? null

  return NextResponse.json({
    ok: testRes.ok,
    recommended_model: flashModel,
    all_flash_models: models.filter(m => m.includes('flash')),
    reply,
    key_prefix: apiKey.slice(0, 8) + '...',
    error: testRes.ok ? null : testBody,
  })
}
