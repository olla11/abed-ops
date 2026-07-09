import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const { date_debut, date_fin } = body
  if (!date_debut) return NextResponse.json({ error: 'Date de début obligatoire' }, { status: 400 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ancien } = await service.from('contrats').select('*').eq('id', id).single()
  if (!ancien) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  await service.from('contrats').update({ statut: 'expire' }).eq('id', id)

  const { data: nouveau, error } = await service.from('contrats').insert({
    profile_id: ancien.profile_id,
    type_contrat: ancien.type_contrat,
    poste: ancien.poste,
    direction: ancien.direction,
    salaire_brut: ancien.salaire_brut,
    date_debut,
    date_fin: date_fin || null,
    statut: 'actif',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('contrats')
  return NextResponse.json({ contrat: nouveau })
}
