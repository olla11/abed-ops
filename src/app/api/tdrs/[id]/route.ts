import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { chapitresValides, STATUT_TOUR, type TdrStatut } from '@/lib/tdr'
import { sanitizeChapitres } from '@/lib/tdr-sanitize'

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

  const { data: tdr } = await supabase.from('tdrs').select('statut, initiateur_id').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })

  // Brouillon : l'initiateur ou un collaborateur en révision édite tout
  // (titre, méta, chapitres). Pendant une étape de validation, le signataire
  // dont c'est le tour peut ajuster les chapitres avant de signer/refuser.
  let canEditMeta = false
  let canEditChapitres = false

  if (tdr.statut === 'brouillon') {
    const isInitiateur = tdr.initiateur_id === user.id
    let estCollabRevision = false
    if (!isInitiateur) {
      const { data: collab } = await supabase
        .from('tdr_collaborateurs').select('permission').eq('tdr_id', id).eq('profile_id', user.id).maybeSingle()
      estCollabRevision = collab?.permission === 'revision'
    }
    canEditMeta = isInitiateur || estCollabRevision
    canEditChapitres = canEditMeta
  } else {
    const roleAttendu = STATUT_TOUR[tdr.statut as TdrStatut]
    if (roleAttendu) {
      const { data: sig } = await supabase
        .from('tdr_signataires').select('profile_id').eq('tdr_id', id).eq('role', roleAttendu).maybeSingle()
      canEditChapitres = sig?.profile_id === user.id
    }
  }

  if (!canEditMeta && !canEditChapitres) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}
  if (body?.titre_activite !== undefined || body?.projet !== undefined || body?.periode !== undefined) {
    if (!canEditMeta) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (body.titre_activite !== undefined) update.titre_activite = String(body.titre_activite).trim()
    if (body.projet !== undefined) update.projet = body.projet ? String(body.projet).trim() : null
    if (body.periode !== undefined) update.periode = body.periode ? String(body.periode).trim() : null
  }
  if (body?.chapitres !== undefined) {
    if (!canEditChapitres) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (!chapitresValides(body.chapitres)) {
      return NextResponse.json({ error: 'Les 8 chapitres du TDR sont obligatoires' }, { status: 400 })
    }
    update.chapitres = sanitizeChapitres(body.chapitres)
  }
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from('tdrs').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
