import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Un dossier déjà validé par la CAF (montant fixé) ou autorisé par le DE ne
// se supprime plus. Tout le reste (en attente à n'importe quelle étape
// antérieure, ou rejeté) peut être retiré par son auteur.
const SUPPRIMABLE_SAUF = ['valide_caf', 'autorise_de', 'demande_soumise']

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: soum } = await admin
    .from('soumissions')
    .select('id, status, manager_id, prestataire_id, titre, paye, prestataire:profiles!soumissions_prestataire_id_fkey(nom, prenoms)')
    .eq('id', id).single()

  if (!soum || soum.prestataire_id !== user.id) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  }
  if (soum.paye || SUPPRIMABLE_SAUF.includes(soum.status)) {
    return NextResponse.json({ error: 'Ce dossier est déjà validé/payé et ne peut plus être supprimé.' }, { status: 400 })
  }

  const prest = soum.prestataire as any
  const message = `${prest?.prenoms ?? ''} ${prest?.nom ?? ''} a supprimé « ${soum.titre} ».`

  if (soum.status === 'soumis' && soum.manager_id) {
    await admin.from('notifications').insert({ user_id: soum.manager_id, titre: 'Dossier supprimé', message, lien: '/timesheets' })
  } else if (soum.status === 'valide_tech') {
    const { data: cafs } = await admin.from('profiles').select('id').eq('role', 'caf').eq('archived', false)
    await Promise.allSettled((cafs ?? []).map(c =>
      admin.from('notifications').insert({ user_id: c.id, titre: 'Dossier supprimé', message, lien: '/timesheets' })
    ))
  }

  const { error } = await admin.from('soumissions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
