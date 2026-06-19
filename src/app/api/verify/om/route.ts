import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: m, error } = await service
    .from('missions')
    .select(`
      id, reference, objet, lieu, status, signe_le,
      date_depart, date_retour, moyen_transport, imputation,
      missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, fonction),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, role, civilite)
    `)
    .eq('id', id)
    .single()

  if (error || !m) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  // Ne retourne que les OM signés
  if (!['signe', 'cloture'].includes(m.status)) {
    return NextResponse.json({ error: 'cet OM n\'est pas encore signé' }, { status: 403 })
  }

  const sg = m.signataire as any
  const mn = m.missionnaire as any

  // Accord genre pour l'intitulé du signataire
  let signataireLabel: string
  if (sg?.role === 'caf') {
    // Récupère civilité du DE
    const { data: de } = await service.from('profiles').select('civilite').eq('role', 'de').single()
    const deCiv = de?.civilite ?? 'M.'
    signataireLabel = deCiv === 'Mme'
      ? 'La Directrice Exécutive (P.O. CAF)'
      : 'Le Directeur Exécutif (P.O. CAF)'
  } else if (sg?.role === 'administrateur') {
    signataireLabel = sg?.civilite === 'Mme' ? 'Administratrice' : 'Administrateur'
  } else {
    signataireLabel = sg?.civilite === 'Mme' ? 'La Directrice Exécutive' : 'Le Directeur Exécutif'
  }

  return NextResponse.json({
    reference: m.reference,
    objet: m.objet,
    lieu: m.lieu,
    missionnaire: `${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`.trim(),
    fonction: mn?.fonction ?? '—',
    date_depart: m.date_depart,
    date_retour: m.date_retour,
    moyen_transport: m.moyen_transport ?? '—',
    signe_le: m.signe_le,
    signataire: `${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`.trim(),
    signataire_label: signataireLabel,
    certifie: true,
  })
}
