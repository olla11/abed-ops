import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const RH_ROLES = ['rh', 'caf', 'admin', 'superadmin']

// DELETE /api/personnel-documents/[id] — RH/CAF/admin/superadmin uniquement
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!RH_ROLES.includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: doc } = await admin.from('personnel_documents').select('storage_path').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const { error } = await supabase.from('personnel_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.storage.from('dossiers-personnel').remove([doc.storage_path])

  return NextResponse.json({ ok: true })
}
