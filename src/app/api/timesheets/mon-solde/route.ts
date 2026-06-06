import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const [{ data: soumissions }, { data: paiements }] = await Promise.all([
    supabase
      .from('soumissions')
      .select('id, titre, periode_mois, periode_annee, heures_retenues, montant_caf, status, paye, created_at')
      .eq('prestataire_id', user.id)
      .in('status', ['valide_tech', 'valide_caf'])
      .order('periode_annee', { ascending: false })
      .order('periode_mois', { ascending: false }),
    supabase
      .from('paiements_prestataires')
      .select('montant, heures_payees, note, created_at')
      .eq('prestataire_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const entries = (soumissions ?? []).map((s: any) => ({
    id: s.id,
    titre: s.titre,
    mois: s.periode_mois,
    annee: s.periode_annee,
    heures: s.heures_retenues ?? 0,
    montant: s.montant_caf ?? 0,
    status: s.status,
    paye: s.paye ?? false,
  }))

  const totalHeures = entries.filter(e => e.status === 'valide_caf').reduce((s, e) => s + e.heures, 0)
  const totalMontant = entries.filter(e => e.status === 'valide_caf').reduce((s, e) => s + e.montant, 0)
  const totalPaye = (paiements ?? []).reduce((s: number, p: any) => s + Number(p.montant), 0)

  return NextResponse.json({
    entries,
    paiements: paiements ?? [],
    totalHeures,
    totalMontant,
    totalPaye,
    resteADevoir: Math.max(0, totalMontant - totalPaye),
  })
}
