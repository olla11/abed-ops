import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// DELETE /api/admin/bulk-delete?type=missions|soumissions|payments|notifications&before=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin uniquement' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')
  const before = req.nextUrl.searchParams.get('before')
  if (!type || !before) return NextResponse.json({ error: 'type et before requis' }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let count = 0

  if (type === 'missions') {
    const { data: toDelete, error: selErr } = await admin
      .from('missions').select('id')
      .in('status', ['cloture', 'rejete'])
      .lt('created_at', before)

    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })
    count = toDelete?.length ?? 0
    if (count > 0) {
      const ids = toDelete!.map(m => m.id)
      // Effacer la FK signe_par avant suppression (notifications cascade, payments cascade)
      await admin.from('missions').update({ signe_par: null }).in('id', ids)
      const { error: delErr } = await admin.from('missions').delete().in('id', ids)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

  } else if (type === 'soumissions') {
    const { data: toDelete, error: selErr } = await admin
      .from('soumissions').select('id')
      .in('status', ['valide_caf', 'rejete_tech', 'rejete_caf'])
      .lt('created_at', before)
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })
    count = toDelete?.length ?? 0
    if (count > 0) {
      const { error: delErr } = await admin.from('soumissions').delete().in('id', toDelete!.map(s => s.id))
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

  } else if (type === 'payments') {
    const { data: toDelete, error: selErr } = await admin
      .from('payments').select('id')
      .in('status', ['reussi', 'echoue', 'annule'])
      .lt('created_at', before)
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })
    count = toDelete?.length ?? 0
    if (count > 0) {
      const { error: delErr } = await admin.from('payments').delete().in('id', toDelete!.map(p => p.id))
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

  } else if (type === 'notifications') {
    const { data: toDelete, error: selErr } = await admin
      .from('notifications').select('id')
      .eq('lu', true)
      .lt('created_at', before)
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })
    count = toDelete?.length ?? 0
    if (count > 0) {
      const { error: delErr } = await admin.from('notifications').delete().in('id', toDelete!.map(n => n.id))
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

  } else {
    return NextResponse.json({ error: 'type non reconnu' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, deleted: count })
}
