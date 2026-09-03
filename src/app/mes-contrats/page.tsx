export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import MesContratsClient from './MesContratsClient'
import { estAAF } from '@/lib/roles'

export default async function MesContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const canSign = ['de', 'dp', 'administrateur'].includes(profile?.role ?? '')

  const admin = createAdminClient()
  const { data: contrats, error: contratsError } = await admin
    .from('contrats')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (contratsError) {
    console.error('[mes-contrats] échec récupération contrats:', contratsError)
  }

  const contratsAvecDemande = (contrats ?? []).map(c => ({ ...c, demande: null }))

  let contratsASigner: any[] = []
  if (canSign) {
    // "Finalisé" = le document est entièrement signé et clos — il n'y a plus
    // rien à signer, donc plus rien à faire ici. Le RH garde une vue complète
    // (y compris les documents finalisés) dans RH > Documents.
    const { data: aSigner, error: aSignerError } = await admin
      .from('contrats')
      .select('*, profile:profiles!profile_id(nom, prenoms)')
      .eq('signataire_id', user.id)
      .neq('workflow_statut', 'finalise')
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
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showAAF={estAAF(profile?.role ?? '')}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <MesContratsClient contrats={contratsAvecDemande} contratsASigner={contratsASigner} canSign={canSign} />
    </>
  )
}
