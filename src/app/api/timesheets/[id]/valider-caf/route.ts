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

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse — CAF uniquement' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire_caf } = body

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, titre, heures_retenues, status, prestataire:profiles!soumissions_prestataire_id_fkey(type_emploi)')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.status !== 'valide_tech') {
    return NextResponse.json({ error: 'Ce dossier n\'est pas encore validé techniquement.' }, { status: 400 })
  }

  if (action === 'valider') {
    // Lire le taux selon type_emploi du prestataire
    const typeEmploi = (soum.prestataire as any)?.type_emploi ?? 'prestataire_direct'
    const clesTaux = typeEmploi === 'prestataire_credit'
      ? ['taux_horaire_credit_fcfa', 'taux_horaire_fcfa']
      : ['taux_horaire_direct_fcfa', 'taux_horaire_fcfa']

    const { data: tauxRows } = await supabase
      .from('parametres').select('cle, valeur').in('cle', clesTaux)
    const tauxMap = Object.fromEntries((tauxRows ?? []).map((r: any) => [r.cle, Number(r.valeur)]))
    const taux = tauxMap[clesTaux[0]] ?? tauxMap[clesTaux[1]] ?? 1500

    const montant_caf = Math.round((soum.heures_retenues ?? 0) * taux)
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
      titre: 'Timesheet validé par la CAF ✓',
      message: `${soum.titre} : ${soum.heures_retenues} h × ${taux.toLocaleString('fr-FR')} F = ${montant_caf.toLocaleString('fr-FR')} XOF.`,
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
