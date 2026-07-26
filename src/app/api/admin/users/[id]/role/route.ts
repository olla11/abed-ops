import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

const ROLES_VALIDES = [
  'missionnaire', 'prestataire', 'manager', 'aaf', 'caf', 'de', 'dp',
  'rh', 'administrateur', 'admin', 'superadmin',
]

// PATCH /api/admin/users/[id]/role — change le rôle d'un compte existant.
// Réservé au superadmin (action sensible : accorde/retire des accès, peut
// transférer le rôle superadmin lui-même).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Accès réservé au superadmin' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const role = body?.role
  if (!ROLES_VALIDES.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from('profiles').update({ role }).eq('id', id)

  if (error) {
    // Contrainte "un seul superadmin" — violation d'unicité (code 23505).
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Il y a déjà un superadmin — rétrogradez-le d\'abord avant d\'en désigner un autre.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag('profiles')
  revalidateTag('personnel')
  return NextResponse.json({ ok: true })
}
