import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { NOTIFICATION_TOPICS } from '@/lib/notification-topics'

const VALID = new Set(NOTIFICATION_TOPICS.map(t => t.value))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { topics } = await req.json() as { topics: string[] }
  const clean = Array.isArray(topics) ? topics.filter(t => VALID.has(t as any)) : []

  const { error } = await supabase
    .from('profiles')
    .update({ notification_topics: clean })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
