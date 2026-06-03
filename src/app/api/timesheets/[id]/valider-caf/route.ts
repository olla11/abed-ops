import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const TAUX_HORAIRE = 1500 // FCFA par heure

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse — CAF uniquement' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire_caf } = body
  // action: 'valider' | 'corriger' | 'rejeter'

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, titre, heures_retenues, status')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.status !== 'valide_tech') {
    return NextResponse.json({ error: 'Ce dossier n\'est pas encore validé techniquement.' }, { status: 400 })
  }

  if (action === 'valider') {
    const montant_caf = Math.round((soum.heures_retenues ?? 0) * TAUX_HORAIRE)
    await supabase.from('soumissions').update({
      status: 'valide_caf',
      montant_caf,
      montant: montant_caf,
      caf_valide_par: user.id,
      caf_valide_le: new Date().toISOString(),
      commentaire_caf: null,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet entièrement validé ✓',
      message: `${soum.titre} : ${soum.heures_retenues}h × 1 500 F = ${montant_caf.toLocaleString('fr-FR')} FCFA à payer.`,
      lien: '/timesheets',
    })
  } else {
    if (!commentaire_caf?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est obligatoire.' }, { status: 400 })
    }
    const newStatus = action === 'rejeter' ? 'rejete_caf' : 'corrections_caf'
    await supabase.from('soumissions').update({
      status: newStatus,
      commentaire_caf,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: action === 'rejeter' ? 'Dossier rejeté par la CAF' : 'Corrections demandées par la CAF',
      message: `${soum.titre} — ${commentaire_caf}`,
      lien: '/timesheets',
    })
  }

  return NextResponse.json({ ok: true })
}
