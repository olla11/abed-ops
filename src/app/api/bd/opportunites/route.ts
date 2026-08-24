import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'
import { notifierAssignationBD } from '@/lib/bd-notify'

// POST /api/bd/opportunites — crée une opportunité. La RLS filtre déjà
// l'accès (titre business_developer ou admin/superadmin), mais on vérifie
// aussi ici pour renvoyer un message clair plutôt qu'une erreur RLS brute.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  if (!profile || !(estBD(profile.titre) || ['admin', 'superadmin'].includes(profile.role))) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer' }, { status: 403 })
  }

  const body = await req.json()
  const {
    titre, bailleur, description_appel, type_opportunite,
    responsable_id, associes_ids, date_identification, date_publication, date_limite, statut,
  } = body

  if (!titre?.trim()) {
    return NextResponse.json({ error: 'Le titre de l\'appel est requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('opportunites_bd')
    .insert({
      titre: titre.trim(),
      bailleur: bailleur || null,
      description_appel: description_appel || null,
      type_opportunite: type_opportunite || 'appel_a_projets',
      responsable_id: responsable_id || null,
      associes_ids: Array.isArray(associes_ids) ? associes_ids : [],
      identifie_par: user.id,
      date_identification: date_identification || new Date().toISOString().slice(0, 10),
      date_publication: date_publication || null,
      date_limite: date_limite || null,
      statut: statut || 'identifie',
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'erreur' }, { status: 400 })

  const admin = createAdminClient()
  await notifierAssignationBD(admin, {
    opportuniteId: data.id,
    titreOpportunite: titre.trim(),
    bailleur: bailleur || null,
    dateLimite: date_limite || null,
    responsableId: responsable_id || null,
    nouveauxAssocies: Array.isArray(associes_ids) ? associes_ids : [],
  }).catch(e => console.error('[bd/opportunites] notif error:', e))

  return NextResponse.json({ ok: true, id: data.id })
}
