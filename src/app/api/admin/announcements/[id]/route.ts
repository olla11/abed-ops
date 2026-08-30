import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// DELETE /api/admin/announcements/[id] — annule une communication ciblée
// programmée qui n'est pas encore partie (status = 'pending').
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'caf', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await admin.from('announcements').select('status, pieces_jointes').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Cette communication est déjà partie, impossible à annuler.' }, { status: 400 })
  }

  const { error } = await admin.from('announcements').update({ status: 'cancelled' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const pieces = (existing.pieces_jointes as { path: string }[]) ?? []
  if (pieces.length > 0) {
    await admin.storage.from('announcement-attachments').remove(pieces.map(p => p.path))
  }

  return NextResponse.json({ ok: true })
}
