import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// POST /api/missions/[id]/signer
// Réservé aux rôles caf et de.
// Génère la référence OM (séquence annuelle) et marque la mission 'signe'.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, fonction').eq('id', user.id).single()

  if (!profile || !['caf', 'de', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  // Générer la référence : N°SSSS-AA/ABED/DE/CAF/AAF
  // SSSS = séquence de l'année (1-based, zero-padded 3 digits)
  const year = new Date().getFullYear() % 100  // 2 digits
  const { count } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
    .not('reference', 'is', null)
    .gte('created_at', `${new Date().getFullYear()}-01-01`)

  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const reference = `${seq}-${year}/ABED/DE/CAF/AAF`

  const { error } = await supabase
    .from('missions')
    .update({
      status: 'signe',
      reference,
      signe_par: user.id,
      signe_le: new Date().toISOString(),
    })
    .eq('id', params.id)
    .in('status', ['soumis', 'brouillon'])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notifier le missionnaire
  const { data: mission } = await supabase
    .from('missions').select('missionnaire_id, objet').eq('id', params.id).single()

  if (mission) {
    await supabase.from('notifications').insert({
      user_id: mission.missionnaire_id,
      titre: 'Ordre de Mission signé',
      message: `Votre OM "${mission.objet}" (réf. ${reference}) est signé et disponible au téléchargement.`,
      lien: `/missions/${params.id}`,
    })
  }

  return NextResponse.json({ ok: true, reference })
}
