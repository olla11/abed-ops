export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { getCachedProfile, getCachedTypesConge } from '@/lib/cache'
import MesCongesClient from './MesCongesClient'
import { estRH, estAAF } from '@/lib/roles'

export default async function MesCongesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile(user.id)
  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

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
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <MesCongesClient
          conges={conges}
          typesConge={typesConge}
          soldes={soldes}
          hasManager={!!profile?.manager_id}
        />
    </>
  )
}
