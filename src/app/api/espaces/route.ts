import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const EspaceSchema = z.object({
  nom:     s.nom,
  couleur: s.couleur,
  icon:    z.string().max(50).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('espaces')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 20, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(EspaceSchema, body)
  if ('error' in v) return v.error

  const admin = createAdminClient()
  const { data, error } = await admin.from('espaces').insert({
    nom: v.data.nom.trim(),
    couleur: v.data.couleur ?? '#16a34a',
    icon: v.data.icon ?? 'folder',
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
