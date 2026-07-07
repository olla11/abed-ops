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

  const admin = createAdminClient()
  const { data: contrats } = await admin
    .from('contrats')
    .select('*, demande:demandes_signature!demande_signature_id(id, statut, fichier_url)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role ?? 'missionnaire'}
        typeEmploi={profile?.type_emploi}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <MesContratsClient contrats={contrats ?? []} />
    </>
  )
}
