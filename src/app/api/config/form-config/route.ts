import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { DEFAULT_FIELDS } from '@/components/FormulaireEditor'

const KEY = 'form_config_demande'

export async function GET() {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await service.from('parametres').select('valeur').eq('cle', KEY).single()
  if (!data) return NextResponse.json({ fields: DEFAULT_FIELDS })
  try {
    return NextResponse.json(JSON.parse(data.valeur))
  } catch {
    return NextResponse.json({ fields: DEFAULT_FIELDS })
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service.from('parametres').upsert(
    { cle: KEY, valeur: JSON.stringify(body), description: 'Configuration du formulaire de demande de paiement' },
    { onConflict: 'cle' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
