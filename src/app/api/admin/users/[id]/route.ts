import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// DELETE /api/admin/users/[id] — supprime le compte Auth + toutes les données (admin uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'acces refuse — admin uniquement' }, { status: 403 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'Impossible de supprimer son propre compte' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Supprimer dans l'ordre des dépendances FK pour éviter les erreurs de contrainte

  // 1. Nullifier les FK nullables dans timesheets
  await admin.from('timesheets').update({ caf_valide_par: null }).eq('caf_valide_par', id)

  // 2. Timesheets où cet utilisateur est prestataire ou manager (NOT NULL)
  const { error: e2 } = await admin
    .from('timesheets')
    .delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (e2) return NextResponse.json({ error: 'Erreur suppression timesheets : ' + e2.message }, { status: 400 })

  // 3. Nullifier les FK nullables dans soumissions (valide_par, paye_par)
  await Promise.all([
    admin.from('soumissions').update({ valide_par: null }).eq('valide_par', id),
    admin.from('soumissions').update({ paye_par: null }).eq('paye_par', id),
  ])

  // 4. Supprimer les soumissions où il est prestataire ou manager (NOT NULL)
  const { error: e4 } = await admin
    .from('soumissions')
    .delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (e4) return NextResponse.json({ error: 'Erreur suppression soumissions : ' + e4.message }, { status: 400 })

  // 5. Supprimer les alertes envoyées (NOT NULL, pas de cascade)
  await admin.from('alertes_envoyees').delete().eq('user_id', id)

  // 5b. Nullifier caf_id dans paiements_prestataires + supprimer ceux où il est prestataire
  await admin.from('paiements_prestataires').update({ caf_id: null }).eq('caf_id', id)
  await admin.from('paiements_prestataires').delete().eq('prestataire_id', id)

  // 5c. Nullifier paye_par dans payments (table payments du schema.sql)
  await admin.from('payments').update({ paye_par: null }).eq('paye_par', id)

  // 6. Nullifier les FK nullables dans demandes_paiement (aaf_id, caf_id, de_id)
  await Promise.all([
    admin.from('demandes_paiement').update({ aaf_id: null }).eq('aaf_id', id),
    admin.from('demandes_paiement').update({ caf_id: null }).eq('caf_id', id),
    admin.from('demandes_paiement').update({ de_id: null }).eq('de_id', id),
  ])

  // 7. Supprimer les demandes de paiement où il est demandeur (NOT NULL)
  const { error: e7 } = await admin
    .from('demandes_paiement')
    .delete()
    .eq('demandeur_id', id)
  if (e7) return NextResponse.json({ error: 'Erreur suppression demandes_paiement : ' + e7.message }, { status: 400 })

  // 8. Nullifier les FK nullables dans rapports_allocations (aaf_id, caf_id, de_id)
  await Promise.all([
    admin.from('rapports_allocations').update({ aaf_id: null }).eq('aaf_id', id),
    admin.from('rapports_allocations').update({ caf_id: null }).eq('caf_id', id),
    admin.from('rapports_allocations').update({ de_id: null }).eq('de_id', id),
  ])

  // 9. Supprimer les rapports d'allocations où il est prestataire ou manager (NOT NULL)
  const { error: e9 } = await admin
    .from('rapports_allocations')
    .delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (e9) return NextResponse.json({ error: 'Erreur suppression rapports_allocations : ' + e9.message }, { status: 400 })

  // 10. Nullifier signe_par sur les missions signées par cet utilisateur (FK nullable)
  await admin.from('missions').update({ signe_par: null }).eq('signe_par', id)

  // 11. Supprimer les missions dont il est missionnaire (cascade vers payments)
  const { error: e11 } = await admin
    .from('missions')
    .delete()
    .eq('missionnaire_id', id)
  if (e11) return NextResponse.json({ error: 'Erreur suppression missions : ' + e11.message }, { status: 400 })

  // 12. Détacher les profils dont il est manager
  await admin.from('profiles').update({ manager_id: null }).eq('manager_id', id)

  // 13. Supprimer le profil explicitement
  await admin.from('profiles').delete().eq('id', id)

  // 14. Supprimer le compte Auth
  const { error: authErr } = await admin.auth.admin.deleteUser(id)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
