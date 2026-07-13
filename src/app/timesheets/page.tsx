export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import TimesheetsClient from '@/components/TimesheetsClient'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, manager_id, type_emploi, email, avatar_url')
    .eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const typeEmploi = profile?.type_emploi ?? null

  const estManager = ['manager', 'caf', 'admin', 'de', 'dp', 'aaf'].includes(role)
  const estCAF = ['caf', 'admin'].includes(role)
  const estAAF = ['aaf', 'admin'].includes(role)
  const estDE = ['de', 'dp', 'administrateur', 'admin'].includes(role)

  // Comptes des items en attente (pour les badges des onglets)
  const [
    { count: countTimesheetsAValider },
    { count: countTimesheetsCAF },
    { count: countRapportsAAF },
    { count: countRapportsCAF },
    { count: countRapportsDE },
  ] = await Promise.all([
    estManager
      ? supabase.from('soumissions').select('*', { count: 'exact', head: true }).eq('status', 'soumis')
      : Promise.resolve({ count: 0 }),
    estCAF
      ? supabase.from('soumissions').select('*', { count: 'exact', head: true }).eq('status', 'valide_tech').eq('paye', false)
      : Promise.resolve({ count: 0 }),
    estAAF
      ? supabase.from('rapports_allocations').select('*', { count: 'exact', head: true }).eq('status', 'valide_tech')
      : Promise.resolve({ count: 0 }),
    estCAF
      ? supabase.from('rapports_allocations').select('*', { count: 'exact', head: true }).eq('status', 'traite_aaf')
      : Promise.resolve({ count: 0 }),
    estDE
      ? supabase.from('rapports_allocations').select('*', { count: 'exact', head: true }).eq('status', 'valide_caf')
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={typeEmploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <TimesheetsClient
        role={role}
        typeEmploi={typeEmploi}
        managerId={profile?.manager_id ?? null}
        hasManager={!!profile?.manager_id}
        countTimesheetsAValider={countTimesheetsAValider ?? 0}
        countTimesheetsCAF={countTimesheetsCAF ?? 0}
        countRapportsAAF={countRapportsAAF ?? 0}
        countRapportsCAF={countRapportsCAF ?? 0}
        countRapportsDE={countRapportsDE ?? 0}
      />
    </>
  )
}
