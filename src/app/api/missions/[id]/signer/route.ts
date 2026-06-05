import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, fonction').eq('id', user.id).single()

  if (!profile || !['caf', 'de', 'admin', 'administrateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  // Vérifier la mission et la règle : le DE ne peut pas signer ses propres OM (seule la CAF peut)
  const { data: missionCheck } = await supabase
    .from('missions')
    .select('missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey(role)')
    .eq('id', id)
    .single()

  if (missionCheck) {
    const missionnaireRole = (missionCheck.missionnaire as any)?.role
    // Si le missionnaire est DE, seule la CAF (ou admin) peut signer
    if (missionnaireRole === 'de' && profile.role === 'de') {
      return NextResponse.json({ error: 'Le Directeur Exécutif ne peut pas signer son propre OM. La CAF doit apposer la signature.' }, { status: 403 })
    }
    // Personne ne peut signer son propre OM
    if (missionCheck.missionnaire_id === user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas signer votre propre ordre de mission.' }, { status: 403 })
    }
  }

  const now = new Date()
  const year2 = String(now.getFullYear()).slice(-2)

  // Trouver le numéro de séquence max déjà utilisé pour cette année
  const { data: existingRefs } = await supabase
    .from('missions')
    .select('reference')
    .like('reference', `%-${year2}/ABED/DE/CAF/AAF`)

  const maxSeq = (existingRefs ?? []).reduce((max, r) => {
    const m = r.reference?.match(/^(\d+)-/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const reference = `${String(maxSeq + 1).padStart(3, '0')}-${year2}/ABED/DE/CAF/AAF`

  const { error } = await supabase
    .from('missions')
    .update({ status: 'signe', reference, signe_par: user.id, signe_le: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['soumis', 'brouillon'])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: mission } = await supabase
    .from('missions').select('missionnaire_id, objet').eq('id', id).single()

  if (mission) {
    await supabase.from('notifications').insert({
      user_id: mission.missionnaire_id,
      titre: 'Ordre de Mission signé',
      message: `Votre OM "${mission.objet}" (réf. ${reference}) est signé et disponible au téléchargement.`,
      lien: `/missions/${id}`,
    })
  }

  return NextResponse.json({ ok: true, reference })
}