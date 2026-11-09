export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF, estBD } from '@/lib/roles'
import BadgeHistoriqueTable from './BadgeHistoriqueTable'

// Accès : RH/CAF/Admin/superadmin voient tout, chaque manager voit son
// équipe — dans les deux cas la portée réelle est imposée par les policies
// RLS de badge_pointages, pas par ce contrôle (qui ne fait que garder les
// simples employés hors de cette vue d'équipe, eux ont déjà leur propre
// historique du jour sur /badge).
const ROLES_AUTORISES = ['manager', 'rh', 'caf', 'admin', 'superadmin']

export default async function BadgeHistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, titre, type_emploi, avatar_url').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  if (!ROLES_AUTORISES.includes(role)) redirect('/badge')

  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  const { data: pointages, error } = await supabase
    .from('badge_pointages')
    .select('id, type, statut, horodatage, distance_bureau_m, verification_faciale_effectuee, justification, profile:profiles!badge_pointages_profile_id_fkey(nom, prenoms)')
    .order('horodatage', { ascending: false })
    .limit(500)
  if (error) console.error('[badge/historique] échec lecture badge_pointages:', error)

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        showBD={estBD(profile?.titre)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container">
        <h2 style={{ color: 'var(--abed-green)', marginBottom: 6 }}>Historique de badgeage</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 24 }}>
          {['rh', 'caf', 'admin', 'superadmin'].includes(role)
            ? 'Pointages entrée/sortie de tous les employés (500 derniers).'
            : 'Pointages entrée/sortie de votre équipe (500 derniers).'}
        </p>
        <BadgeHistoriqueTable pointages={(pointages ?? []) as any[]} />
      </div>
    </>
  )
}
