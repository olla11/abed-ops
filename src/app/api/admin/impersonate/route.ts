import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('id, nom, prenoms, role')
    .eq('id', user.id)
    .single()

  if (me?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Réservé au superadmin' }, { status: 403 })
  }

  const { targetId } = await req.json()
  if (!targetId || targetId === user.id) {
    return NextResponse.json({ error: 'Cible invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, nom, prenoms, role, email, archived')
    .eq('id', targetId)
    .single()

  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  if (target.archived) return NextResponse.json({ error: 'Ce compte est archivé' }, { status: 400 })
  if (target.role === 'superadmin') {
    return NextResponse.json({ error: 'Impossible de se connecter en tant que superadmin' }, { status: 403 })
  }
  if (!target.email) return NextResponse.json({ error: "Ce compte n'a pas d'email" }, { status: 400 })

  // 1. Sauvegarder la session actuelle (celle du superadmin) pour pouvoir y revenir.
  const { data: { session: currentSession } } = await supabase.auth.getSession()
  if (!currentSession) return NextResponse.json({ error: 'Session introuvable' }, { status: 401 })

  // 2. Générer un lien magique pour la cible et échanger le token contre une vraie session,
  //    afin que la RLS soit ensuite évaluée exactement comme si la cible était connectée.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? 'Échec de génération du lien' }, { status: 500 })
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('impersonator_refresh_token', currentSession.refresh_token, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8, secure: true,
  })
  res.cookies.set('impersonation_info', JSON.stringify({
    adminId: me.id,
    adminNom: me.nom,
    adminPrenoms: me.prenoms,
    targetNom: target.nom,
    targetPrenoms: target.prenoms,
    targetRole: target.role,
  }), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 })

  await admin.from('impersonation_log').insert({
    admin_id: me.id,
    admin_nom: me.nom,
    admin_prenoms: me.prenoms,
    target_id: target.id,
    target_nom: target.nom,
    target_prenoms: target.prenoms,
    target_role: target.role,
    ip: req.headers.get('x-forwarded-for'),
  })

  return res
}
