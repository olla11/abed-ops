import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { annulerAppelDeFondsBrouillon } from '@/lib/appel-de-fonds'

// DELETE — annule un appel de fonds encore à l'état 'brouillon' (jamais
// envoyé dans le circuit de signature) et libère les paiements Pay Roll
// concernés. CAF/admin uniquement.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const result = await annulerAppelDeFondsBrouillon(admin, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
