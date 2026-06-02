import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// POST /api/admin/create-user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const body = await req.json()
  const {
    email, password, nom, prenoms, civilite, telephone, fonction,
    ifu, grade_indice, adresse, date_naissance, lieu_naissance, nationalite,
  } = body

  if (!email || !password || !nom || !prenoms) {
    return NextResponse.json({ error: 'Champs requis : email, password, nom, prenoms' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, prenoms },
  })

  if (authError || !newUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Echec creation Auth' }, { status: 400 })
  }

  // UPDATE du profil cree par le trigger handle_new_user()
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      nom:            nom,
      prenoms:        prenoms,
      civilite:       civilite       || 'M.',
      telephone:      telephone      || null,
      fonction:       fonction       || null,
      ifu:            ifu            || null,
      grade_indice:   grade_indice   || null,
      adresse:        adresse        || null,
      date_naissance: date_naissance || null,
      lieu_naissance: lieu_naissance || null,
      nationalite:    nationalite    || null,
    })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json(
      { error: 'Compte cree mais profil incomplet : ' + profileError.message },
      { status: 207 }
    )
  }

  return NextResponse.json({ ok: true, userId: newUser.user.id })
}