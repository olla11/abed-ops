import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { chapitresValides, type Chapitre } from '@/lib/tdr'
import { sanitizeChapitres } from '@/lib/tdr-sanitize'
import { notifyTdr } from '@/lib/tdr-notify'
import { escapeHtml } from '@/lib/html'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tdrs')
    .select(`*,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms, email),
      responsable_technique:profiles!tdrs_responsable_technique_id_fkey(id, nom, prenoms),
      cloture_par_profile:profiles!tdrs_cloture_par_fkey(id, nom, prenoms),
      derniere_modif_par_profile:profiles!tdrs_derniere_modif_par_fkey(id, nom, prenoms),
      collaborateurs:tdr_collaborateurs(id, profile_id, permission, profile:profiles!tdr_collaborateurs_profile_id_fkey(id, nom, prenoms)),
      signataires:tdr_signataires(id, role, profile_id, ordre, statut, signe_le, commentaire, profile:profiles!tdr_signataires_profile_id_fkey(id, nom, prenoms, civilite))
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('statut, initiateur_id, titre_activite, chapitres').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })

  // Le contenu (chapitres) est modifiable par toute personne impliquée sur le
  // TDR — initiateur, collaborateur en révision, ou n'importe quel signataire
  // (responsable technique/CAF/DE), peu importe le statut du TDR et peu
  // importe à qui le tour revient actuellement. Seule la méta (titre/projet/
  // période) reste réservée à l'initiateur/collaborateur-révision en brouillon,
  // comme avant.
  const isInitiateur = tdr.initiateur_id === user.id
  const [{ data: collab }, { data: signataires }] = await Promise.all([
    supabase.from('tdr_collaborateurs').select('permission').eq('tdr_id', id).eq('profile_id', user.id).maybeSingle(),
    supabase.from('tdr_signataires').select('id').eq('tdr_id', id).eq('profile_id', user.id).limit(1),
  ])
  const estCollabRevision = collab?.permission === 'revision'
  const estSignataire = (signataires?.length ?? 0) > 0

  const canEditMeta = tdr.statut === 'brouillon' && (isInitiateur || estCollabRevision)
  const canEditChapitres = isInitiateur || estCollabRevision || estSignataire

  if (!canEditMeta && !canEditChapitres) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}
  if (body?.titre_activite !== undefined || body?.projet !== undefined || body?.periode !== undefined) {
    if (!canEditMeta) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (body.titre_activite !== undefined) update.titre_activite = String(body.titre_activite).trim()
    if (body.projet !== undefined) update.projet = body.projet ? String(body.projet).trim() : null
    if (body.periode !== undefined) update.periode = body.periode ? String(body.periode).trim() : null
  }

  let chapitresChanges: string[] = []
  if (body?.chapitres !== undefined) {
    if (!canEditChapitres) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (!chapitresValides(body.chapitres)) {
      return NextResponse.json({ error: 'Les 8 chapitres du TDR sont obligatoires' }, { status: 400 })
    }
    const nouveaux = sanitizeChapitres(body.chapitres)
    const anciens = tdr.chapitres as Chapitre[]
    chapitresChanges = nouveaux
      .filter(c => JSON.stringify(c) !== JSON.stringify(anciens.find(a => a.cle === c.cle)))
      .map(c => c.titre)
    update.chapitres = nouveaux
    update.derniere_modif_par = user.id
  }
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from('tdrs').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifie tout le monde sur le TDR quand du contenu change après soumission
  // — uniquement sur un enregistrement explicite (pas l'auto-save silencieux
  // toutes les 4s, qui spammerait sinon toutes les personnes impliquées).
  if (body?.notifier && chapitresChanges.length > 0 && tdr.statut !== 'brouillon') {
    after(async () => {
      const { data: profil } = await supabase.from('profiles').select('nom, prenoms').eq('id', user.id).single()
      const auteurNom = profil ? `${profil.prenoms} ${profil.nom}` : 'Quelqu\'un'
      await notifyTdr(id, {
        titre: `✏️ Modifications sur le TDR « ${escapeHtml(tdr.titre_activite)} »`,
        message: `${escapeHtml(auteurNom)} a modifié le contenu du TDR — chapitre${chapitresChanges.length > 1 ? 's' : ''} : ${chapitresChanges.map(escapeHtml).join(', ')}.`,
        excludeId: user.id,
      }).catch(e => console.error('[notifyTdr modification]:', e))
    })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('statut, initiateur_id').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.initiateur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (tdr.statut !== 'brouillon') {
    return NextResponse.json({ error: 'Seul un TDR en brouillon peut être supprimé' }, { status: 409 })
  }

  const { error } = await supabase.from('tdrs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
