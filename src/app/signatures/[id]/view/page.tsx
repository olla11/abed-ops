export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
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

  // Generate signed URL for the document
  let docUrl: string | null = null
  if (demande.fichier_url) {
    try {
      const path = (demande.fichier_url as string).split('/documents/').at(-1)
      if (path) {
        const { data } = await admin.storage.from('documents').createSignedUrl(path, 3600)
        docUrl = data?.signedUrl ?? null
      }
    } catch { /* no file */ }
  }

  return (
    <ViewClient
      titre={demande.titre}
      docUrl={docUrl}
      signataires={(demande.signataires ?? []) as any}
    />
  )
}
