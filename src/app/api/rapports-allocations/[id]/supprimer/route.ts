import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Un rapport autorisé ne se supprime plus (paiement déjà en cours) — tout le
// reste (en attente à n'importe quelle étape, ou rejeté) peut être retiré
// par son auteur.
const SUPPRIMABLE_SAUF = ['autorise']

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
  if (SUPPRIMABLE_SAUF.includes(rapport.status)) {
    return NextResponse.json({ error: 'Ce rapport est déjà autorisé et ne peut plus être supprimé.' }, { status: 400 })
  }

  const prest = rapport.prestataire as any
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const message = `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a supprimé son rapport de ${mois}.`

  // Prévenir qui détenait le dossier avant suppression, selon son statut.
  if (rapport.status === 'soumis' && rapport.manager_id) {
    await admin.from('notifications').insert({
      user_id: rapport.manager_id, titre: 'Rapport supprimé', message, lien: '/timesheets',
    })
  } else {
    const rolesParStatut: Record<string, string[]> = {
      valide_tech: ['aaf', 'caf'],
      traite_aaf: ['caf'],
      valide_caf: ['de', 'dp', 'administrateur'].includes(prest?.role ?? '') ? ['administrateur'] : ['de'],
    }
    const roles = rolesParStatut[rapport.status]
    if (roles) {
      const { data: destinataires } = await admin.from('profiles').select('id').in('role', roles).eq('archived', false)
      await Promise.allSettled((destinataires ?? []).map(d =>
        admin.from('notifications').insert({ user_id: d.id, titre: 'Rapport supprimé', message, lien: '/aaf/rapports-allocations' })
      ))
    }
  }

  const { error } = await admin.from('rapports_allocations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
