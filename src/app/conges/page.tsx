export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import MesCongesClient from './MesCongesClient'

export default async function MesCongesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi, manager_id').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const [{ data: conges }, { data: typesConge }, { data: soldes }] = await Promise.all([
    supabase.from('conges')
      .select('*, type_conge:types_conge(nom)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('types_conge').select('*').eq('actif', true).order('nom'),
    supabase.from('soldes_conges')
      .select('*, type_conge:types_conge(nom)')
      .eq('profile_id', user.id)
      .eq('annee', new Date().getFullYear()),
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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
        <MesCongesClient
          conges={conges ?? []}
          typesConge={typesConge ?? []}
          soldes={soldes ?? []}
          hasManager={!!profile?.manager_id}
        />
      </div>
    </>
  )
}
