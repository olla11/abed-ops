import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'
import { resoudrePeriode } from '@/lib/bd-rapport-periode'

// Version JSON (légère) des mêmes données que le PDF — pour l'aperçu à
// l'écran avant de lancer la génération du PDF (Puppeteer, plus coûteux).
const SUPERVISEUR_ROLES = ['de', 'dp', 'caf', 'admin', 'administrateur', 'superadmin']

const SELECT = `id, titre, bailleur, type_opportunite, statut, date_identification, date_soumission,
  montant_demande, montant_obtenu,
  responsable:profiles!opportunites_bd_responsable_id_fkey(nom, prenoms)`

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  if (!profile || !(estBD(profile.titre) || SUPERVISEUR_ROLES.includes(profile.role))) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer et aux superviseurs' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periode = resoudrePeriode(
    searchParams.get('type'),
    Number(searchParams.get('annee')),
    searchParams.get('mois') ? Number(searchParams.get('mois')) : null,
    searchParams.get('trimestre') ? Number(searchParams.get('trimestre')) : null,
  )
  if (!periode) return NextResponse.json({ error: 'Paramètres de période invalides' }, { status: 400 })

  const [{ data: identifiees, error: err1 }, { data: soumises, error: err2 }] = await Promise.all([
    supabase.from('opportunites_bd').select(SELECT)
      .gte('date_identification', periode.dateDebut).lte('date_identification', periode.dateFin)
      .order('date_identification', { ascending: true }),
    supabase.from('opportunites_bd').select(SELECT)
      .gte('date_soumission', periode.dateDebut).lte('date_soumission', periode.dateFin)
      .order('date_soumission', { ascending: true }),
  ])
  if (err1 || err2) return NextResponse.json({ error: (err1 ?? err2)?.message ?? 'erreur' }, { status: 400 })

  return NextResponse.json({
    periodeLabel: periode.periodeLabel,
    identifiees: identifiees ?? [],
    soumises: soumises ?? [],
  })
}
