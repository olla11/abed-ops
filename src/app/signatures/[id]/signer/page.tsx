export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import SignerClient from './SignerClient'

export default async function SignerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: demandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Get demande with signataires
  const { data: demande, error } = await admin
    .from('demandes_signature')
    .select(`
      id, titre, description, fichier_url, statut,
      signataires(id, profile_id, signe, signe_le)
    `)
    .eq('id', demandeId)
    .single()

  if (error || !demande) notFound()

  // Verify current user is an unsigned signatory
  const myEntry = (demande.signataires as Array<{ id: string; profile_id: string; signe: boolean; signe_le: string | null }>)
    .find(s => s.profile_id === user.id)

  if (!myEntry || myEntry.signe || demande.statut !== 'en_attente') {
    redirect('/signatures')
  }

  // Get user profile
  const { data: profile } = await admin
    .from('profiles')
    .select('nom, prenoms')
    .eq('id', user.id)
    .single()

  const userName = profile ? `${profile.prenoms} ${profile.nom}` : user.email ?? 'Utilisateur'

  return (
    <SignerClient
      demandeId={demandeId}
      titre={demande.titre}
      fichierUrl={demande.fichier_url ?? null}
      userName={userName}
    />
  )
}
