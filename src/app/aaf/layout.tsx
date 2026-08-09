import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import AAFNav from './AAFNav'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estAAF } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function AAFLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  if (!profile || !(estAAF(profile.role) || ['admin', 'superadmin'].includes(profile.role))) redirect('/dashboard')

  const realRole = profile.role
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  return (
    <>
      <AppHeader
        userName={`${profile.prenoms ?? ''} ${profile.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile.type_emploi}
        showAAF={true}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        avatarUrl={profile.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">
        <AAFNav role={role} />
        {children}
      </div>
    </>
  )
}
