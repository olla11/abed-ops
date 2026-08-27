import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estRH } from '@/lib/roles'

async function checkAcces(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Non autorisé' }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || me?.role === 'admin')) return { ok: false as const, status: 403, error: 'Accès refusé' }
  return { ok: true as const, userId: user.id }
}

export async function GET() {
  const supabase = await createClient()
  const acces = await checkAcces(supabase)
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status })

  const service = createAdminClient()
  const { data, error } = await service.from('contrat_templates').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const acces = await checkAcces(supabase)
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status })

  const body = await req.json()
  const { nom, type_contrat, categorie_document, objet_template, articles, champs, actif } = body
  if (!nom || !type_contrat || !categorie_document) {
    return NextResponse.json({ error: 'Nom, type et catégorie sont obligatoires.' }, { status: 400 })
  }

  const service = createAdminClient()
  const { data, error } = await service.from('contrat_templates').insert({
    nom, type_contrat, categorie_document,
    objet_template: objet_template || null,
    articles: Array.isArray(articles) ? articles : [],
    champs: Array.isArray(champs) ? champs : [],
    actif: actif ?? true,
    created_by: acces.userId,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
