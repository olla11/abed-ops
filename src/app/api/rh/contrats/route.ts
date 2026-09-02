import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { revalidateTag } from 'next/cache'
import { estRH } from '@/lib/roles'
import { creerContratEtDemarrerCircuit } from '@/lib/contrat-creation'

// Catégories pour lesquelles le destinataire peut ne pas encore avoir de
// compte My ABED (l'offre/la convention précède souvent son intégration) —
// un CDD/CDI ou un Avenant suppose au contraire une personne déjà en place.
function categorieAutoriseDestinataireExterne(categorie: string, typeContrat: string): boolean {
  if (categorie === 'Offre' || categorie === 'Offre de stage') return true
  if (categorie === 'Convention' && ['Bourse de formation', 'Consultant'].includes(typeContrat)) return true
  return false
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'de', 'dp'].includes(me?.role ?? ''))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const service = createAdminClient()

  const { data, error } = await service.from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .order('date_fin', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contrats: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || me?.role === 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const {
    profile_id, type_contrat, date_debut, poste, direction, date_fin,
    salaire_brut, observations, categorie_document, contrat_parent_id,
    objet, articles, commentaires_rh, source_financement, template_id,
    destinataire_email,
  } = body

  const categorie = categorie_document || 'Contrat'
  const emailDestinataire = (destinataire_email ?? '').trim().toLowerCase() || null
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!type_contrat || !date_debut) {
    return NextResponse.json({ error: 'Type et date de début sont obligatoires.' }, { status: 400 })
  }
  if (!profile_id && !emailDestinataire) {
    return NextResponse.json({ error: 'Employé (ou email du destinataire) est obligatoire.' }, { status: 400 })
  }
  if (emailDestinataire) {
    if (!EMAIL_RE.test(emailDestinataire)) {
      return NextResponse.json({ error: 'Adresse email du destinataire invalide.' }, { status: 400 })
    }
    if (!categorieAutoriseDestinataireExterne(categorie, type_contrat)) {
      return NextResponse.json({ error: "Un destinataire sans compte n'est possible que pour une Offre ou une Convention de bourse/consultant." }, { status: 400 })
    }
  }

  const service = createAdminClient()

  // For Avenant: validate parent contract exists and is active
  let parentId: string | null = null
  if (categorie === 'Avenant') {
    if (!contrat_parent_id) {
      return NextResponse.json({ error: 'Un avenant doit être lié à un contrat parent actif.' }, { status: 400 })
    }
    const { data: parent } = await service.from('contrats')
      .select('id, statut, profile_id')
      .eq('id', contrat_parent_id)
      .single()
    if (!parent || parent.statut !== 'actif') {
      return NextResponse.json({ error: 'Le contrat parent sélectionné n\'est pas actif.' }, { status: 400 })
    }
    if (parent.profile_id !== profile_id) {
      return NextResponse.json({ error: 'Le contrat parent ne correspond pas à l\'employé sélectionné.' }, { status: 400 })
    }
    parentId = contrat_parent_id
  }

  const resultat = await creerContratEtDemarrerCircuit(service, user.id, {
    profile_id: profile_id || null,
    destinataire_email: emailDestinataire,
    type_contrat, date_debut,
    poste: poste || null,
    direction: direction || null,
    date_fin: date_fin || null,
    salaire_brut: salaire_brut || null,
    observations: observations || null,
    categorie_document: categorie,
    contrat_parent_id: parentId,
    renouvele_depuis: null,
    objet: objet || null,
    articles: articles || [],
    commentaires_rh: commentaires_rh || null,
    source_financement: source_financement || null,
    template_id: template_id || null,
  })

  if ('error' in resultat) return NextResponse.json({ error: resultat.error }, { status: resultat.status })

  revalidateTag('contrats')
  return NextResponse.json({ contrat: resultat.contrat })
}
