import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// POST /api/admin/create-user
// RÃ©servÃ© admin / rh / caf. CrÃ©e un compte Supabase Auth + profil.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifiÃ©' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) {
    return NextResponse.json({ error: 'accÃ¨s refusÃ©' }, { status: 403 })
  }

  const body = await req.json()
  const { email, password, nom, prenoms, telephone, fonction } = body

  if (!email || !password || !nom || !prenoms) {
    return NextResponse.json({ error: 'Champs requis : email, password, nom, prenoms' }, { status: 400 })
  }

  // Utilise la service_role key pour crÃ©er un compte sans confirmation email
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
    return NextResponse.json({ error: authError?.message ?? 'Ã‰chec crÃ©ation Auth' }, { status: 400 })
  }

  // Mettre Ã  jour le profil (crÃ©Ã© par le trigger) avec les champs supplÃ©mentaires
  const { error: profileError } = await admin
    .from('profiles')
    .update({ telephone: telephone || null, fonction: fonction || null })
    .eq('id', newUser.user.id)

  if (profileError) {
    return NextResponse.json({ error: 'Compte crÃ©Ã© mais profil incomplet : ' + profileError.message }, { status: 207 })
  }

  return NextResponse.json({ ok: true, userId: newUser.user.id })
}

