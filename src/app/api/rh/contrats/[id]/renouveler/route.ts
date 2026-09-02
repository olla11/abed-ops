import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { revalidateTag } from 'next/cache'
import { estRH } from '@/lib/roles'
import { creerContratEtDemarrerCircuit } from '@/lib/contrat-creation'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || me?.role === 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const { type_contrat, date_debut, poste, direction, date_fin, salaire_brut, objet, articles, commentaires_rh, source_financement } = body
  if (!type_contrat || !date_debut) {
    return NextResponse.json({ error: 'Type et date de début sont obligatoires.' }, { status: 400 })
  }

  const service = createAdminClient()

  const { data: ancien } = await service.from('contrats').select('*').eq('id', id).single()
  if (!ancien) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
  if (!ancien.profile_id) return NextResponse.json({ error: 'Ce document (destinataire sans compte) ne peut pas être renouvelé ici.' }, { status: 400 })

  // Comme une création normale : numéro, employé signe, puis le signataire
  // habituel (DE, ou administrateur si l'employé est DE/DP) signe, avec les
  // mêmes notifications — le type de contrat, le poste, la direction et le
  // salaire peuvent tous changer par rapport à l'ancien contrat. L'objet et
  // les articles sont repris de l'ancien contrat par défaut (texte légal) si
  // non fournis, pour ne pas perdre le contenu du document.
  const resultat = await creerContratEtDemarrerCircuit(service, user.id, {
    profile_id: ancien.profile_id,
    destinataire_email: null,
    type_contrat, date_debut,
    poste: poste ?? ancien.poste,
    direction: direction ?? ancien.direction,
    date_fin: date_fin || null,
    salaire_brut: salaire_brut ?? ancien.salaire_brut,
    observations: null,
    categorie_document: ancien.categorie_document ?? 'Contrat',
    contrat_parent_id: null,
    renouvele_depuis: ancien.id,
    objet: objet ?? ancien.objet,
    articles: articles ?? ancien.articles ?? [],
    commentaires_rh: commentaires_rh ?? null,
    source_financement: source_financement ?? ancien.source_financement,
    template_id: null,
  })

  if ('error' in resultat) return NextResponse.json({ error: resultat.error }, { status: resultat.status })

  const motif = `Renouvelé le ${new Date().toLocaleDateString('fr-FR')} — nouveau contrat ${resultat.contrat.numero} (${type_contrat}).`
  await service.from('contrats').update({ statut: 'expire', motif_resiliation: motif }).eq('id', id)

  revalidateTag('contrats')
  return NextResponse.json({ contrat: resultat.contrat })
}
