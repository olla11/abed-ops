import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { nom, prenoms, civilite, telephone, ifu, fonction, adresse, date_naissance, lieu_naissance, nationalite } = await req.json()

  if (!nom?.trim() || !prenoms?.trim()) {
    return NextResponse.json({ error: 'Nom et prénoms obligatoires' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ nom: nom.trim(), prenoms: prenoms.trim(), civilite, telephone, ifu, fonction, adresse, date_naissance: date_naissance || null, lieu_naissance, nationalite })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
