import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé à l\'administrateur système.' }, { status: 403 })
  }

  const body = await req.json()
  if (body.confirmation !== 'RESET') {
    return NextResponse.json({ error: 'Confirmation invalide.' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tables = ['notifications', 'demandes_paiement', 'soumissions', 'missions', 'rapports_allocations']
  const errors: string[] = []

  for (const table of tables) {
    const { error } = await admin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error && !error.message.includes('does not exist')) {
      errors.push(`${table}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 207 })
  }

  return NextResponse.json({ ok: true })
}
