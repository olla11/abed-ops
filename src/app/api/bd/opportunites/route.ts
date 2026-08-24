import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'

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
  const { titre, bailleur, description_appel, personnes_associees, date_identification, date_publication, date_limite, statut } = body

  if (!titre?.trim()) {
    return NextResponse.json({ error: 'Le titre de l\'appel est requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('opportunites_bd')
    .insert({
      titre: titre.trim(),
      bailleur: bailleur || null,
      description_appel: description_appel || null,
      personnes_associees: personnes_associees || null,
      identifie_par: user.id,
      date_identification: date_identification || new Date().toISOString().slice(0, 10),
      date_publication: date_publication || null,
      date_limite: date_limite || null,
      statut: statut || 'identifie',
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'erreur' }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}
