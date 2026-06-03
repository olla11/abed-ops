import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const body = await req.json()
  const { action, heures_retenues, justification_heures, commentaire_manager } = body
  // action: 'valider' | 'corriger_ts' | 'corriger_livrable' | 'rejeter'

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, manager_id, titre, heures_declarees, status')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.manager_id !== user.id) return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  if (soum.status !== 'soumis') return NextResponse.json({ error: 'statut invalide' }, { status: 400 })

  if (action === 'valider') {
    if (!heures_retenues || heures_retenues <= 0) {
      return NextResponse.json({ error: 'Veuillez saisir les heures retenues.' }, { status: 400 })
    }
    if (heures_retenues < soum.heures_declarees && !justification_heures?.trim()) {
      return NextResponse.json({
        error: 'Les heures retenues sont inférieures aux heures déclarées. Veuillez justifier cet écart.',
        requiresJustification: true,
      }, { status: 422 })
    }

    await supabase.from('soumissions').update({
      status: 'valide_tech',
      heures_retenues,
      justification_heures: justification_heures || null,
      valide_par: user.id,
      valide_le: new Date().toISOString(),
      commentaire_manager: null,
    }).eq('id', id)

    // Chercher un CAF pour notifier
    const { data: caf } = await supabase
      .from('profiles').select('id').eq('role', 'caf').limit(1).single()
    if (caf) {
      await supabase.from('notifications').insert({
        user_id: caf.id,
        titre: 'Timesheet validé techniquement — à contrôler',
        message: `${soum.titre} — ${heures_retenues}h retenues. Vérifiez la facture.`,
        lien: '/timesheets',
      })
    }
    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet validé techniquement',
      message: `${soum.titre} : ${heures_retenues}h retenues sur ${soum.heures_declarees}h. En attente de validation CAF.`,
      lien: '/timesheets',
    })
  } else {
    const newStatus = action === 'rejeter' ? 'rejete_tech' : 'corrections_tech'
    if (!commentaire_manager?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est obligatoire pour rejeter ou demander des corrections.' }, { status: 400 })
    }
    await supabase.from('soumissions').update({
      status: newStatus,
      commentaire_manager,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: action === 'rejeter' ? 'Timesheet rejeté' : 'Corrections demandées sur votre timesheet',
      message: `${soum.titre} — ${commentaire_manager}`,
      lien: '/timesheets',
    })
  }

  return NextResponse.json({ ok: true })
}
