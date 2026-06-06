import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const [souRes, rapRes, omRes, demRes] = await Promise.all([
    supabase.from('soumissions')
      .select('id, titre, status, periode_mois, periode_annee, montant_caf, created_at')
      .eq('prestataire_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase.from('rapports_allocations')
      .select('id, status, periode_mois, periode_annee, montant_allocation, created_at')
      .eq('prestataire_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase.from('missions')
      .select('id, reference, objet, status, date_debut, montant_avance, created_at')
      .eq('missionnaire_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase.from('demandes_paiement')
      .select('id, objet, status, montant, urgence, created_at')
      .eq('demandeur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const items: any[] = []

  for (const s of souRes.data ?? []) {
    items.push({
      id: s.id, type: 'timesheet',
      reference: s.titre,
      periode: `${s.periode_mois}/${s.periode_annee}`,
      montant: s.montant_caf,
      status: s.status,
      created_at: s.created_at,
    })
  }

  for (const r of rapRes.data ?? []) {
    items.push({
      id: r.id, type: 'rapport',
      reference: `Rapport ${r.periode_mois}/${r.periode_annee}`,
      periode: `${r.periode_mois}/${r.periode_annee}`,
      montant: r.montant_allocation,
      status: r.status,
      created_at: r.created_at,
    })
  }

  for (const m of omRes.data ?? []) {
    items.push({
      id: m.id, type: 'om',
      reference: m.reference ?? m.objet,
      periode: m.date_debut ? new Date(m.date_debut).toLocaleDateString('fr-FR') : '—',
      montant: m.montant_avance,
      status: m.status,
      created_at: m.created_at,
    })
  }

  for (const d of demRes.data ?? []) {
    items.push({
      id: d.id, type: 'demande',
      reference: d.objet,
      periode: new Date(d.created_at).toLocaleDateString('fr-FR'),
      montant: d.montant,
      status: d.status,
      urgence: d.urgence,
      created_at: d.created_at,
    })
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ data: items })
}
