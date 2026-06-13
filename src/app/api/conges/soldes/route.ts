import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('soldes_conges')
    .select('*, type_conge:types_conge(nom)')
    .eq('profile_id', user.id)
    .eq('annee', new Date().getFullYear())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ soldes: data })
}
