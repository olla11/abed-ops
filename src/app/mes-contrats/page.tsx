export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import MesContratsClient from './MesContratsClient'

export default async function MesContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const canSign = ['de', 'administrateur'].includes(profile?.role ?? '')

  const admin = createAdminClient()
  const { data: contrats, error: contratsError } = await admin
    .from('contrats')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (contratsError) {
    console.error('[mes-contrats] échec récupération contrats:', contratsError)
  }

  const demandeIds = (contrats ?? [])
    .map(c => c.demande_signature_id)
    .filter((id): id is string => !!id)

  const demandesById = new Map<string, { id: string; statut: string; fichier_url: string | null }>()
  if (demandeIds.length > 0) {
    const { data: demandes, error: demandesError } = await admin
      .from('demandes_signature')
      .select('id, statut, fichier_url')
      .in('id', demandeIds)
    if (demandesError) {
      console.error('[mes-contrats] échec récupération demandes_signature:', demandesError)
    }
    for (const d of demandes ?? []) demandesById.set(d.id, d)
  }

  const contratsAvecDemande = (contrats ?? []).map(c => ({
    ...c,
    demande: c.demande_signature_id ? demandesById.get(c.demande_signature_id) ?? null : null,
  }))

  let contratsASigner: any[] = []
  if (canSign) {
    const { data: aSigner, error: aSignerError } = await admin
      .from('contrats')
      .select('*, profile:profiles!profile_id(nom, prenoms)')
      .eq('signataire_id', user.id)
      .order('created_at', { ascending: false })
    if (aSignerError) {
      console.error('[mes-contrats] échec récupération contrats à signer:', aSignerError)
    }
    contratsASigner = aSigner ?? []
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role ?? 'missionnaire'}
        typeEmploi={profile?.type_emploi}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <MesContratsClient contrats={contratsAvecDemande} contratsASigner={contratsASigner} canSign={canSign} />
    </>
  )
}
