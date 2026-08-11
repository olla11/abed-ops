import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Supprimable seulement avant toute validation technique ('soumis'), ou si
// rejeté (donc jamais validé) — dès que le responsable direct a validé, le
// dossier est figé comme pour la correction.
const REJETE = ['rejete_manager', 'rejete_aaf', 'rejete_caf', 'refuse_de']
const SUPPRIMABLE = ['soumis', ...REJETE]

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rapport } = await admin
    .from('rapports_allocations')
    .select('id, status, manager_id, prestataire_id, periode_mois, periode_annee, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom, prenoms, role)')
    .eq('id', id).single()

  if (!rapport || rapport.prestataire_id !== user.id) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  }
  if (!SUPPRIMABLE.includes(rapport.status)) {
    return NextResponse.json({ error: 'Ce rapport ne peut plus être supprimé à ce stade.' }, { status: 400 })
  }

  const prest = rapport.prestataire as any
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const message = `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a supprimé son rapport de ${mois}.`

  // Seul un rapport 'soumis' a encore un détenteur actif (le responsable
  // direct) à prévenir — un rapport rejeté est déjà revenu à son auteur,
  // personne d'autre n'a de dossier en cours à ce sujet.
  if (rapport.status === 'soumis' && rapport.manager_id) {
    await admin.from('notifications').insert({
      user_id: rapport.manager_id, titre: 'Rapport supprimé', message, lien: '/timesheets',
    })
  }

  const { error } = await admin.from('rapports_allocations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
