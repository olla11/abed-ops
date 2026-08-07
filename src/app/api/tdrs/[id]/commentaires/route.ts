import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { notifyTdr } from '@/lib/tdr-notify'
import { escapeHtml } from '@/lib/html'
import type { Chapitre } from '@/lib/tdr'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tdr_commentaires')
    .select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, parent_id, auteur_id')
    .eq('tdr_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Le RLS de `profiles` masque les autres personnes à qui n'a pas un rôle
  // privilégié (caf/de/dp/admin/manager/rh/superadmin) : un simple
  // collaborateur/missionnaire ne verrait donc ni le nom ni la couleur des
  // commentaires des autres via un embed profiles!... classique. On passe
  // par `profiles_annuaire`, qui contourne cette restriction pour l'essentiel
  // (nom/prénoms), comme ailleurs dans le module TDR.
  const auteurIds = [...new Set((data ?? []).map(c => c.auteur_id).filter((v): v is string => !!v))]
  const profilParId = new Map<string, { id: string; nom: string; prenoms: string }>()
  if (auteurIds.length > 0) {
    const { data: profils } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').in('id', auteurIds)
    for (const p of profils ?? []) profilParId.set(p.id, p)
  }

  const enrichi = (data ?? []).map(c => ({ ...c, auteur: c.auteur_id ? (profilParId.get(c.auteur_id) ?? null) : null }))
  return NextResponse.json({ data: enrichi })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const contenu = (body?.contenu ?? '').trim()
  const parentId = (body?.parent_id ?? '').trim() || null
  if (!contenu) {
    return NextResponse.json({ error: 'contenu est requis' }, { status: 400 })
  }

  let chapitreCle: string
  let markId: string
  let texteCite: string | null

  if (parentId) {
    // Une réponse hérite de l'ancrage (chapitre/sélection) du commentaire parent.
    const { data: parent } = await supabase
      .from('tdr_commentaires').select('chapitre_cle, mark_id').eq('id', parentId).eq('tdr_id', id).single()
    if (!parent) return NextResponse.json({ error: 'Commentaire parent introuvable' }, { status: 404 })
    chapitreCle = parent.chapitre_cle
    markId = parent.mark_id
    texteCite = null
  } else {
    chapitreCle = (body?.chapitre_cle ?? '').trim()
    markId = (body?.mark_id ?? '').trim()
    texteCite = (body?.texte_cite ?? '').trim().slice(0, 300) || null
    if (!chapitreCle || !markId) {
      return NextResponse.json({ error: 'chapitre_cle et mark_id sont requis' }, { status: 400 })
    }
  }

  const { data, error } = await supabase.from('tdr_commentaires').insert({
    tdr_id: id,
    chapitre_cle: chapitreCle,
    mark_id: markId,
    texte_cite: texteCite,
    contenu,
    auteur_id: user.id,
    parent_id: parentId,
  }).select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, parent_id, auteur:profiles!tdr_commentaires_auteur_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifie (in-app + email) tout le monde sur le TDR, avec le commentaire
  // complet et le chapitre concerné — sauf l'auteur du commentaire lui-même.
  // Après la réponse : le webhook Resend/l'insertion notifications ne doivent
  // pas retarder la confirmation d'envoi du commentaire à l'auteur.
  after(async () => {
    const { data: tdr } = await supabase.from('tdrs').select('titre_activite, chapitres').eq('id', id).single()
    if (!tdr) return
    const chapitreTitre = (tdr.chapitres as Chapitre[]).find(c => c.cle === chapitreCle)?.titre ?? chapitreCle
    const auteur = data.auteur as any
    const auteurNom = auteur ? `${auteur.prenoms} ${auteur.nom}` : 'Quelqu\'un'
    const citation = texteCite ? ` (sur « ${escapeHtml(texteCite)} »)` : ''
    await notifyTdr(id, {
      titre: `💬 Nouveau commentaire sur le TDR « ${escapeHtml(tdr.titre_activite)} »`,
      message: `${escapeHtml(auteurNom)} a commenté le chapitre « ${escapeHtml(chapitreTitre)} »${citation} :<br><br>« ${escapeHtml(contenu)} »`,
      excludeId: user.id,
    }).catch(e => console.error('[notifyTdr commentaire]:', e))
  })

  return NextResponse.json({ data })
}
