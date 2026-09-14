import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { envoyerBonDeCommandeCircuit } from '@/lib/bon-de-commande'

// POST — après prévisualisation du brouillon, envoie le bon de commande en
// signature au DE ou au PCA (déterminé à la génération, selon le montant).
// AAF/admin uniquement.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aaf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const result = await envoyerBonDeCommandeCircuit(admin, { bonDeCommandeId: id, createurId: user.id })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, numero: result.numero })
}
