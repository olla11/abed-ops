import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { annulerBonDeCommandeBrouillon, retirerBonDeCommandeEnCircuit } from '@/lib/bon-de-commande'

// DELETE — supprime totalement un bon de commande pas encore signé :
// annule un brouillon, ou retire un bon déjà envoyé en signature tant que
// le DE/PCA n'a pas encore signé. AAF/admin uniquement.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aaf', 'caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: bc } = await admin.from('bons_de_commande').select('statut').eq('id', id).single()
  if (!bc) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 })

  const result = bc.statut === 'brouillon'
    ? await annulerBonDeCommandeBrouillon(admin, id)
    : await retirerBonDeCommandeEnCircuit(admin, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
