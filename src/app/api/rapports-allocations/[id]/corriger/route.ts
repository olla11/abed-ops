import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Statuts "en cours" où le soumissionnaire peut encore corriger son rapport
// sans repasser par la case départ — un rejet a déjà son propre circuit de
// re-soumission (qui repart de 'soumis'), et un rapport autorisé ne se
// modifie plus (paiement déjà en cours).
const CORRIGEABLE = ['soumis', 'valide_tech', 'traite_aaf', 'valide_caf']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { rapport_texte, fichier_rapport_url } = body
  if (!rapport_texte?.trim()) return NextResponse.json({ error: 'Rapport requis' }, { status: 400 })
  if (!fichier_rapport_url) return NextResponse.json({ error: 'Document Word requis' }, { status: 400 })

  const admin = createAdminClient()

  const { data: rapport } = await admin
    .from('rapports_allocations')
    .select('id, status, manager_id, prestataire_id, periode_mois, periode_annee, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom, prenoms, role)')
    .eq('id', id).single()

  if (!rapport || rapport.prestataire_id !== user.id) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  }
  if (!CORRIGEABLE.includes(rapport.status)) {
    return NextResponse.json({ error: 'Ce rapport ne peut plus être corrigé à ce stade.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await admin.from('rapports_allocations').update({
    rapport_texte, fichier_rapport_url, corrige_le: now,
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const prest = rapport.prestataire as any
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const message = `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a mis à jour son rapport de ${mois} — relisez la nouvelle version avant de le traiter.`

  // Prévenir qui détient actuellement le dossier, selon son statut courant.
  if (rapport.status === 'soumis' && rapport.manager_id) {
    await admin.from('notifications').insert({
      user_id: rapport.manager_id, titre: 'Rapport mis à jour', message, lien: '/timesheets',
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
        admin.from('notifications').insert({ user_id: d.id, titre: 'Rapport mis à jour', message, lien: '/aaf/rapports-allocations' })
      ))
    }
  }

  return NextResponse.json({ ok: true })
}
