import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'caf', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('announcements')
    .select('id, sujet, canaux, destinataires_count, created_at, sender_id, status, scheduled_at, sent_at, pieces_jointes, profiles!announcements_sender_id_fkey(nom, prenoms)')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ data: data ?? [] })
}
