export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getCachedProfile, getCachedTypesConge } from '@/lib/cache'
import MesCongesClient from './MesCongesClient'

export default async function MesCongesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile(user.id)
  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const [conges, typesConge, soldes] = await Promise.all([
    supabase.from('conges')
      .select('*, type_conge:types_conge(nom)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(r => r.data ?? []),
    getCachedTypesConge(),
    supabase.from('soldes_conges')
      .select('*, type_conge:types_conge(nom)')
      .eq('profile_id', user.id)
      .eq('annee', new Date().getFullYear())
      .then(r => r.data ?? []),
  ])

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <MesCongesClient
          conges={conges}
          typesConge={typesConge}
          soldes={soldes}
          hasManager={!!profile?.manager_id}
        />
    </>
  )
}
