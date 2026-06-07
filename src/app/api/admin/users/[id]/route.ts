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

  // 3. Nullifier valide_par dans soumissions (FK nullable)
  await admin.from('soumissions').update({ valide_par: null }).eq('valide_par', id)

  // 4. Supprimer les soumissions où il est prestataire ou manager (NOT NULL)
  const { error: e4 } = await admin
    .from('soumissions')
    .delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (e4) return NextResponse.json({ error: 'Erreur suppression soumissions : ' + e4.message }, { status: 400 })

  // 5. Supprimer les alertes envoyées (NOT NULL, pas de cascade)
  await admin.from('alertes_envoyees').delete().eq('user_id', id)

  // 6. Nullifier signe_par sur les missions signées par cet utilisateur (FK nullable)
  await admin.from('missions').update({ signe_par: null }).eq('signe_par', id)

  // 7. Supprimer les missions dont il est missionnaire (cascade vers payments)
  const { error: e7 } = await admin
    .from('missions')
    .delete()
    .eq('missionnaire_id', id)
  if (e7) return NextResponse.json({ error: 'Erreur suppression missions : ' + e7.message }, { status: 400 })

  // 8. Détacher les profils dont il est manager
  await admin.from('profiles').update({ manager_id: null }).eq('manager_id', id)

  // 9. Supprimer le profil explicitement
  await admin.from('profiles').delete().eq('id', id)

  // 10. Supprimer le compte Auth
  const { error: authErr } = await admin.auth.admin.deleteUser(id)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
