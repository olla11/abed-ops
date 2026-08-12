import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Autorisation finale DE des timesheets prestataires — symétrique à
// l'étape valide_caf -> autorise déjà en place pour les rapports mensuels
// (rapports_allocations). Sans cette étape, la CAF pouvait payer dès sa
// propre validation financière.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  if (!['de', 'admin', 'superadmin', 'administrateur'].includes(role)) {
    return NextResponse.json({ error: 'accès refusé — DE uniquement' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire_de } = body

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, titre, status, montant_caf, periode_mois, periode_annee')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.status !== 'valide_caf') {
    return NextResponse.json({ error: "Ce dossier n'est pas encore validé par la CAF." }, { status: 400 })
  }
  // Personne ne s'auto-autorise, même un DE dont le timesheet propre en
  // serait au bon stade — même logique que le blocage déjà en place côté
  // rapports mensuels.
  if (soum.prestataire_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas autoriser votre propre timesheet.' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const mois = new Date(soum.periode_annee, soum.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  if (action === 'autoriser') {
    await supabase.from('soumissions').update({
      status: 'autorise_de',
      de_valide_par: user.id,
      de_valide_le: now,
      commentaire_de: null,
      corrige_le: null,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet autorisé ✓',
      message: `${soum.titre} — ${mois} : autorisé par le DE. Le paiement va être traité par la CAF.`,
      lien: '/timesheets',
    })

    // La CAF peut désormais payer — la prévenir plutôt que de la laisser
    // découvrir le changement de statut au hasard.
    const { data: cafUsers } = await supabase.from('profiles').select('id').eq('role', 'caf').eq('archived', false)
    await Promise.allSettled((cafUsers ?? []).map(c =>
      supabase.from('notifications').insert({
        user_id: c.id,
        titre: 'Timesheet autorisé — paiement possible',
        message: `${soum.titre} — ${(soum.montant_caf ?? 0).toLocaleString('fr-FR')} FCFA.`,
        lien: '/timesheets',
      })
    ))
  } else {
    if (!commentaire_de?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est obligatoire.' }, { status: 400 })
    }
    await supabase.from('soumissions').update({
      status: 'refuse_de',
      commentaire_de,
      corrige_le: null,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet refusé par le DE',
      message: `${soum.titre} — ${mois} — ${commentaire_de}`,
      lien: '/timesheets',
    })
  }

  return NextResponse.json({ ok: true })
}
