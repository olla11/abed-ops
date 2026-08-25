import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'
import { resoudrePeriode } from '@/lib/bd-rapport-periode'
import { genererRapportBDPdf, nomFichierRapportBDPdf, type RapportOpportunite } from '@/lib/bd-rapport-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

const SELECT = `id, titre, bailleur, type_opportunite, statut, date_identification, date_soumission, date_limite,
  montant_demande, montant_obtenu,
  identifie_par:profiles!opportunites_bd_identifie_par_fkey(nom, prenoms),
  responsable:profiles!opportunites_bd_responsable_id_fkey(nom, prenoms)`

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre').eq('id', user.id).single()
  if (!estBD(profile?.titre)) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer' }, { status: 403 })
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

  const pdfBuffer = await genererRapportBDPdf({
    periodeLabel: periode.periodeLabel,
    periodeType: periode.periodeType,
    identifiees: (identifiees ?? []) as unknown as RapportOpportunite[],
    soumises: (soumises ?? []) as unknown as RapportOpportunite[],
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierRapportBDPdf(periode.slug)}"`,
    },
  })
}
