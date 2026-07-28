import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { civiliteToGenre, deriveVilleFromAdresse } from '@/lib/rh-derive'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { nom, prenoms, civilite, telephone, ifu, fonction, adresse, date_naissance, lieu_naissance, nationalite } = await req.json()

  if (!nom?.trim() || !prenoms?.trim()) {
    return NextResponse.json({ error: 'Nom et prénoms obligatoires' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { nom: nom.trim(), prenoms: prenoms.trim(), civilite, telephone, ifu, fonction, adresse, date_naissance: date_naissance || null, lieu_naissance, nationalite }

  // Genre et ville déduits automatiquement (civilité M./Mme sans ambiguïté,
  // ville = dernier segment de l'adresse) — on ne les écrase pas quand ils
  // ne peuvent pas être déduits avec confiance (Dr/Pr, adresse sans virgule).
  const genreDeduit = civiliteToGenre(civilite)
  if (genreDeduit) updates.genre = genreDeduit
  const villeDeduite = deriveVilleFromAdresse(adresse)
  if (villeDeduite) updates.ville = villeDeduite

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
