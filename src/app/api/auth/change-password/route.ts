import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const Schema = z.object({ password: s.password })

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(Schema, body)
  if ('error' in v) return v.error

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service.auth.admin.updateUserById(user.id, { password: v.data.password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('profiles').update({ must_change_password: false }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
