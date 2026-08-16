import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { escapeHtml } from '@/lib/html'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('document_commentaires')
    .select('id, mark_id, texte_cite, contenu, created_at, updated_at, parent_id, auteur:profiles!document_commentaires_auteur_id_fkey(id, nom, prenoms)')
    .eq('demande_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const contenu = (body?.contenu ?? '').trim()
  const parentId = (body?.parent_id ?? '').trim() || null
  if (!contenu) return NextResponse.json({ error: 'contenu est requis' }, { status: 400 })

  let markId: string
  let texteCite: string | null

  if (parentId) {
    const { data: parent } = await supabase.from('document_commentaires').select('mark_id').eq('id', parentId).eq('demande_id', id).single()
    if (!parent) return NextResponse.json({ error: 'Commentaire parent introuvable' }, { status: 404 })
    markId = parent.mark_id
    texteCite = null
  } else {
    markId = (body?.mark_id ?? '').trim()
    texteCite = (body?.texte_cite ?? '').trim().slice(0, 300) || null
    if (!markId) return NextResponse.json({ error: 'mark_id est requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('document_commentaires').insert({
    demande_id: id, mark_id: markId, texte_cite: texteCite, contenu, auteur_id: user.id, parent_id: parentId,
  }).select('id, mark_id, texte_cite, contenu, created_at, updated_at, parent_id, auteur:profiles!document_commentaires_auteur_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  after(async () => {
    const admin = createAdminClient()
    const { data: document } = await admin.from('demandes_signature').select('titre, createur_id').eq('id', id).single()
    if (!document) return
    const { data: participants } = await admin.from('document_participants').select('profile_id').eq('demande_id', id)
    const ids = new Set<string>([document.createur_id, ...(participants ?? []).map(p => p.profile_id)])
    ids.delete(user.id)
    if (ids.size === 0) return

    const auteur = data.auteur as any
    const auteurNom = auteur ? `${auteur.prenoms} ${auteur.nom}` : 'Quelqu\'un'
    const citation = texteCite ? ` (sur « ${escapeHtml(texteCite)} »)` : ''
    const titre = parentId ? `💬 Nouvelle réponse sur « ${escapeHtml(document.titre)} »` : `💬 Nouveau commentaire sur « ${escapeHtml(document.titre)} »`
    const message = parentId
      ? `${escapeHtml(auteurNom)} a répondu à un commentaire : « ${escapeHtml(contenu)} »`
      : `${escapeHtml(auteurNom)} a commenté${citation} : « ${escapeHtml(contenu)} »`
    const { data: profils } = await admin.from('profiles').select('id, email, nom, prenoms').in('id', [...ids])
    for (const p of profils ?? []) {
      await admin.from('notifications').insert({ user_id: p.id, titre, message, lien: `/documents/${id}` })
    }
  })

  return NextResponse.json({ data })
}
