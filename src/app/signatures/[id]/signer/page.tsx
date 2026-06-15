export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
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

  const { data: demande, error } = await admin
    .from('demandes_signature')
    .select(`
      id, titre, description, fichier_url, statut, created_at, createur_id,
      createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
      signataires(profile_id, signe, signe_le, profile:profiles!signataires_profile_id_fkey(nom, prenoms))
    `)
    .eq('id', demandeId)
    .single()

  if (error || !demande) {
    redirect('/signatures')
  }

  // Verify current user is a signatory and hasn't signed yet
  const myEntry = (demande as any).signataires?.find(
    (s: any) => s.profile_id === user.id && !s.signe
  )
  if (!myEntry || demande.statut !== 'en_attente') {
    redirect('/signatures')
  }

  // Get user profile
  const { data: profile } = await admin
    .from('profiles')
    .select('nom, prenoms')
    .eq('id', user.id)
    .single()

  const userName = profile ? `${profile.prenoms} ${profile.nom}` : user.email ?? ''

  return (
    <SignerClient
      demandeId={demandeId}
      titre={(demande as any).titre}
      fichierUrl={(demande as any).fichier_url ?? null}
      userName={userName}
    />
  )
}
