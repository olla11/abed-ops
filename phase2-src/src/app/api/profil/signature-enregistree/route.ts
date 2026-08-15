import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Signature personnelle enregistrée (dessinée ou importée), réutilisable
// d'une signature à l'autre sans avoir à la refaire — voir le mode "Fichier
// enregistré" de SignerClient. Une seule par utilisateur pour l'instant.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const image = body?.image as string | undefined
  if (!image || !image.startsWith('data:image/png')) {
    return NextResponse.json({ error: 'Image PNG requise' }, { status: 400 })
  }
  // Une signature manuscrite ne doit pas dépasser quelques centaines de Ko —
  // ce plafond écarte un envoi anormalement volumineux avant qu'il n'atteigne la base.
  if (image.length > 2_000_000) {
    return NextResponse.json({ error: 'Image trop volumineuse' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ signature_sauvegardee_b64: image }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ signature_sauvegardee_b64: null }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
