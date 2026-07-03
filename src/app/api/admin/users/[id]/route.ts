import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

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

  // Helper : retourne une erreur 400 avec le contexte exact de l'échec
  function fail(step: string, msg: string) {
    return NextResponse.json({ error: `[${step}] ${msg}` }, { status: 400 })
  }

  // Supprimer dans l'ordre des dépendances FK pour éviter les erreurs de contrainte

  // ── timesheets ──
  await admin.from('timesheets').update({ caf_valide_par: null }).eq('caf_valide_par', id)
  const { error: eTs } = await admin.from('timesheets').delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (eTs) return fail('timesheets', eTs.message)

  // ── soumissions ──
  await admin.from('soumissions').update({ valide_par: null }).eq('valide_par', id)
  await admin.from('soumissions').update({ paye_par: null }).eq('paye_par', id)
  const { error: eSoum } = await admin.from('soumissions').delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (eSoum) return fail('soumissions', eSoum.message)

  // ── alertes_envoyees ──
  await admin.from('alertes_envoyees').delete().eq('user_id', id)

  // ── paiements_prestataires ──
  await admin.from('paiements_prestataires').update({ caf_id: null }).eq('caf_id', id)
  const { error: ePaiPrest } = await admin.from('paiements_prestataires').delete()
    .eq('prestataire_id', id)
  if (ePaiPrest) return fail('paiements_prestataires', ePaiPrest.message)

  // ── demandes_paiement ──
  await Promise.all([
    admin.from('demandes_paiement').update({ aaf_id: null }).eq('aaf_id', id),
    admin.from('demandes_paiement').update({ caf_id: null }).eq('caf_id', id),
    admin.from('demandes_paiement').update({ de_id: null }).eq('de_id', id),
  ])
  const { error: eDem } = await admin.from('demandes_paiement').delete()
    .eq('demandeur_id', id)
  if (eDem) return fail('demandes_paiement', eDem.message)

  // ── rapports_allocations ──
  await Promise.all([
    admin.from('rapports_allocations').update({ aaf_id: null }).eq('aaf_id', id),
    admin.from('rapports_allocations').update({ caf_id: null }).eq('caf_id', id),
    admin.from('rapports_allocations').update({ de_id: null }).eq('de_id', id),
  ])
  const { error: eRap } = await admin.from('rapports_allocations').delete()
    .or(`prestataire_id.eq.${id},manager_id.eq.${id}`)
  if (eRap) return fail('rapports_allocations', eRap.message)

  // ── missions ──
  await admin.from('missions').update({ signe_par: null }).eq('signe_par', id)
  const { error: eMis } = await admin.from('missions').delete()
    .eq('missionnaire_id', id)
  if (eMis) return fail('missions', eMis.message)

  // ── profiles ──
  await admin.from('profiles').update({ manager_id: null }).eq('manager_id', id)
  const { error: eProf } = await admin.from('profiles').delete().eq('id', id)
  if (eProf) return fail('profiles', eProf.message)

  // ── compte Auth ──
  const { error: authErr } = await admin.auth.admin.deleteUser(id)
  if (authErr) return fail('auth.deleteUser', authErr.message)

  revalidateTag('profiles')
  revalidateTag('personnel')
  return NextResponse.json({ ok: true })
}
