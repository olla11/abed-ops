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

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, manager_id, status')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.prestataire_id !== user.id) return NextResponse.json({ error: 'acces refuse' }, { status: 403 })

  const correctableStatuses = ['corrections_tech', 'corrections_caf', 'rejete_tech', 'rejete_caf']
  if (!correctableStatuses.includes(soum.status)) {
    return NextResponse.json({ error: 'Ce dossier ne peut pas être resoumis.' }, { status: 400 })
  }

  const body = await req.json()
  const { fichier_timesheet_url, fichier_livrable_url, fichier_facture_url } = body

  const updates: Record<string, any> = {
    status: 'soumis',
    commentaire_manager: null,
    commentaire_caf: null,
    heures_retenues: null,
    justification_heures: null,
    montant_caf: null,
    valide_par: null,
    valide_le: null,
    caf_valide_par: null,
    caf_valide_le: null,
  }

  if (fichier_timesheet_url) updates.fichier_timesheet_url = fichier_timesheet_url
  if (fichier_livrable_url) updates.fichier_livrable_url = fichier_livrable_url
  if (fichier_facture_url) updates.fichier_facture_url = fichier_facture_url

  const { error } = await supabase.from('soumissions').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notifier le manager
  await supabase.from('notifications').insert({
    user_id: soum.manager_id,
    titre: 'Dossier corrigé et resoumis',
    message: `Le prestataire a resoumis son dossier pour révision.`,
    lien: '/timesheets',
  })

  return NextResponse.json({ ok: true })
}
