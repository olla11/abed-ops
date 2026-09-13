import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET — liste complète de la file Pay Roll, la RLS de la table filtre déjà
// aux rôles concernés (caf, aaf, de, dp, administrateur, admin, superadmin).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('pay_roll')
    .select('*, compte_bancaire:comptes_bancaires(id, nom)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
