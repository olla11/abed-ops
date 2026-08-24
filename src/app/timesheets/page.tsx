export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import TimesheetsClient from '@/components/TimesheetsClient'
import { estRH, estAAF as roleEstAAF } from '@/lib/roles'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, titre, nom, prenoms, manager_id, type_emploi, email, avatar_url')
    .eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()
  const typeEmploi = profile?.type_emploi ?? null

  const estManager = ['manager', 'caf', 'admin', 'de', 'dp', 'aaf'].includes(role)
  const estCAF = ['caf', 'admin'].includes(role)
  const estAAF = roleEstAAF(role) || role === 'admin'
  // L'autorisation finale des rapports d'allocation est réservée au Directeur
  // Exécutif (et à l'administrateur en cas d'auto-soumission par de/dp) — le DP
  // n'y figure plus, il ne fait que la validation technique de premier niveau.
  const estDE = ['de', 'administrateur', 'admin'].includes(role)

  // Comptes des items en attente (pour les badges des onglets)
  const [
    { count: countTimesheetsAValider },
    { count: countRapportsAValider },
    { count: countTimesheetsCAF },
    { count: countRapportsAAF },
    { count: countRapportsCAF },
    { count: countRapportsDE },
    { count: countTimesheetsDE },
  ] = await Promise.all([
    estManager
      ? supabase.from('soumissions').select('*', { count: 'exact', head: true }).eq('status', 'soumis').eq('manager_id', user.id)
      : Promise.resolve({ count: 0 }),
    estManager
      ? supabase.from('rapports_allocations').select('*', { count: 'exact', head: true }).eq('status', 'soumis').eq('manager_id', user.id)
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
    estDE
      ? supabase.from('soumissions').select('*', { count: 'exact', head: true }).eq('status', 'valide_caf')
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={typeEmploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={roleEstAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <TimesheetsClient
        role={role}
        userId={user.id}
        typeEmploi={typeEmploi}
        managerId={profile?.manager_id ?? null}
        hasManager={!!profile?.manager_id}
        countTimesheetsAValider={countTimesheetsAValider ?? 0}
        countRapportsAValider={countRapportsAValider ?? 0}
        countTimesheetsCAF={countTimesheetsCAF ?? 0}
        countRapportsAAF={countRapportsAAF ?? 0}
        countRapportsCAF={countRapportsCAF ?? 0}
        countRapportsDE={countRapportsDE ?? 0}
        countTimesheetsDE={countTimesheetsDE ?? 0}
      />
    </>
  )
}
