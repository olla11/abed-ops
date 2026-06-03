import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const bucket = req.nextUrl.searchParams.get('bucket') ?? 'timesheets'
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path manquant' }, { status: 400 })

  // Vérifier que l'utilisateur est bien autorisé : prestataire (owner) ou manager/caf/admin
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const canAccess = ['manager', 'caf', 'de', 'admin'].includes(profile?.role ?? '') ||
    path.startsWith(user.id + '/')

  if (!canAccess) return NextResponse.json({ error: 'acces refuse' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, 3600) // 1h

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'url introuvable' }, { status: 404 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
