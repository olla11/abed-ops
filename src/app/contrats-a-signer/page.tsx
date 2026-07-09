export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ContratsASignerClient from './ContratsASignerClient'

export default async function ContratsASignerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  if (!['de', 'administrateur'].includes(role)) redirect('/accueil')

  const admin = createAdminClient()
  const { data: contrats, error: contratsError } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(nom, prenoms)')
    .eq('signataire_id', user.id)
    .order('created_at', { ascending: false })

  if (contratsError) {
    console.error('[contrats-a-signer] échec récupération contrats:', contratsError)
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <ContratsASignerClient contrats={contrats ?? []} />
    </>
  )
}
