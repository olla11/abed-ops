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
    .select('*, compte_bancaire:comptes_bancaires(id, nom), appel_de_fonds:appels_de_fonds(id, numero, statut)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Les paiements non satisfaits (non payé / à payer) doivent rester visibles
  // en haut de la file — les payés sont de l'historique, pas des actions à
  // faire — puis, dans chaque groupe, les plus anciens d'abord (ordre
  // d'arrivée : premier autorisé par le DE, premier traité).
  const tri = [...(data ?? [])].sort((a, b) => {
    const aPaye = a.statut === 'paye' ? 1 : 0
    const bPaye = b.statut === 'paye' ? 1 : 0
    if (aPaye !== bPaye) return aPaye - bPaye
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ data: tri })
}
