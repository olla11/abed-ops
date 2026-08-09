import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Uniquement avant que la CAF ait fixé le montant (valide_caf) — au-delà, le
// montant est déjà calculé sur les fichiers fournis, une correction en place
// pourrait le rendre incohérent. Un dossier rejeté/à corriger repasse par
// resoumettre (qui repart de 'soumis'), pas par cette route.
const CORRIGEABLE = ['soumis', 'valide_tech']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { fichier_timesheet_url, fichier_livrable_url, fichier_facture_url, periode_mois, periode_annee } = body
  if (!fichier_timesheet_url && !fichier_livrable_url && !fichier_facture_url && periode_mois == null && periode_annee == null) {
    return NextResponse.json({ error: 'Aucun fichier à remplacer' }, { status: 400 })
  }
  if (periode_mois != null && (periode_mois < 1 || periode_mois > 12))
    return NextResponse.json({ error: 'Mois invalide' }, { status: 400 })

  const admin = createAdminClient()

  const { data: soum } = await admin
    .from('soumissions')
    .select('id, status, manager_id, prestataire_id, titre, periode_mois, periode_annee, prestataire:profiles!soumissions_prestataire_id_fkey(nom, prenoms)')
    .eq('id', id).single()

  if (!soum || soum.prestataire_id !== user.id) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  }
  if (!CORRIGEABLE.includes(soum.status)) {
    return NextResponse.json({ error: 'Ce dossier ne peut plus être corrigé à ce stade.' }, { status: 400 })
  }

  const updates: Record<string, any> = { corrige_le: new Date().toISOString() }
  if (fichier_timesheet_url) updates.fichier_timesheet_url = fichier_timesheet_url
  if (fichier_livrable_url) updates.fichier_livrable_url = fichier_livrable_url
  if (fichier_facture_url) updates.fichier_facture_url = fichier_facture_url
  const periodeChangee = (periode_mois != null && periode_mois !== soum.periode_mois) || (periode_annee != null && periode_annee !== soum.periode_annee)
  if (periode_mois != null) updates.periode_mois = periode_mois
  if (periode_annee != null) updates.periode_annee = periode_annee

  const { error } = await admin.from('soumissions').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const prest = soum.prestataire as any
  const message = periodeChangee
    ? `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a mis à jour « ${soum.titre} » (période corrigée : ${periode_mois ?? soum.periode_mois}/${periode_annee ?? soum.periode_annee}) — relisez la nouvelle version avant de le traiter.`
    : `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a mis à jour « ${soum.titre} » — relisez la nouvelle version avant de le traiter.`

  if (soum.status === 'soumis' && soum.manager_id) {
    await admin.from('notifications').insert({ user_id: soum.manager_id, titre: 'Dossier mis à jour', message, lien: '/timesheets' })
  } else if (soum.status === 'valide_tech') {
    const { data: cafs } = await admin.from('profiles').select('id').eq('role', 'caf').eq('archived', false)
    await Promise.allSettled((cafs ?? []).map(c =>
      admin.from('notifications').insert({ user_id: c.id, titre: 'Dossier mis à jour', message, lien: '/timesheets' })
    ))
  }

  return NextResponse.json({ ok: true })
}
