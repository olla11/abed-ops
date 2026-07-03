import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

type RouteContext = { params: Promise<{ id: string }> }

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifie' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'acces refuse — admin uniquement' }, { status: 403 }) }
  return { userId: user.id }
}

// PATCH /api/admin/users/[id] — archive le compte (désactive sans supprimer l'historique)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createClient()
  const check = await checkAdmin(supabase)
  if ('error' in check) return check.error

  if (id === check.userId) {
    return NextResponse.json({ error: 'Impossible d\'archiver son propre compte' }, { status: 400 })
  }

  const body = await req.json()
  const reason: string = body.reason ?? 'Non précisé'

  const admin = adminClient()

  // Vérifier si le compte existe et n'est pas déjà archivé
  const { data: target } = await admin.from('profiles').select('archived, nom, prenoms').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  if (target.archived) return NextResponse.json({ error: 'Ce compte est déjà archivé' }, { status: 400 })

  // Désactiver le compte Auth (ban = ne peut plus se connecter)
  await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' }) // ~100 ans

  // Marquer le profil comme archivé + retirer le rôle actif
  const { error } = await admin.from('profiles').update({
    archived: true,
    archived_at: new Date().toISOString(),
    archived_reason: reason,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Détacher de tous les sous-profils qui l'avaient comme manager
  await admin.from('profiles').update({ manager_id: null }).eq('manager_id', id)

  revalidateTag('profiles')
  revalidateTag('personnel')
  return NextResponse.json({ ok: true, archived: true })
}

// PUT /api/admin/users/[id] — restaure un compte archivé
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createClient()
  const check = await checkAdmin(supabase)
  if ('error' in check) return check.error

  const admin = adminClient()

  const { data: target } = await admin.from('profiles').select('archived').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  if (!target.archived) return NextResponse.json({ error: 'Ce compte n\'est pas archivé' }, { status: 400 })

  // Réactiver le compte Auth
  await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })

  const { error } = await admin.from('profiles').update({
    archived: false,
    archived_at: null,
    archived_reason: null,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('profiles')
  revalidateTag('personnel')
  return NextResponse.json({ ok: true, restored: true })
}

// DELETE /api/admin/users/[id] — suppression définitive (comptes sans historique uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params
  const supabase = await createClient()
  const check = await checkAdmin(supabase)
  if ('error' in check) return check.error

  if (id === check.userId) {
    return NextResponse.json({ error: 'Impossible de supprimer son propre compte' }, { status: 400 })
  }

  const admin = adminClient()

  function fail(step: string, msg: string) {
    return NextResponse.json({ error: `[${step}] ${msg}` }, { status: 400 })
  }

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
