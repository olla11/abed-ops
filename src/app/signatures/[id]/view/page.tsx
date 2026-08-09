export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getComposedSignedUrl } from '@/lib/pdf-signature'
import ViewClient from './ViewClient'

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: demande } = await admin
    .from('demandes_signature')
    .select('id, titre, fichier_url, statut, signataires(profile_id, signe, signe_le, sig_x, sig_y, sig_page, profile:profiles!signataires_profile_id_fkey(nom, prenoms))')
    .eq('id', id)
    .single()

  if (!demande) redirect('/signatures')

  // Recompose le PDF depuis l'original intact + les tampons déjà
  // enregistrés (voir getComposedSignedUrl) plutôt que de pointer vers un
  // fichier potentiellement muté en place.
  let docUrl: string | null = null
  if (demande.fichier_url) {
    try {
      docUrl = await getComposedSignedUrl(admin, id, demande.fichier_url as string, 3600)
    } catch { /* no file */ }
  }
  // Depuis cette correction, tout nouveau document est converti en PDF dès
  // l'envoi (voir /api/signatures/create) — cette détection ne reste utile
  // que pour d'éventuels anciens documents Word/Excel enregistrés avant.
  const isPdf = !demande.fichier_url || /\.pdf$/i.test(demande.fichier_url as string)

  return (
    <ViewClient
      titre={demande.titre}
      docUrl={docUrl}
      isPdf={isPdf}
      signataires={(demande.signataires ?? []) as any}
    />
  )
}
