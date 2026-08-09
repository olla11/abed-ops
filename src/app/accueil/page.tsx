export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import AccueilClient from '@/components/AccueilClient'
import { estRH } from '@/lib/roles'

export default async function AccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, type_emploi, avatar_url, fonction').eq('id', user.id).single()

  if (profile?.must_change_password) redirect('/auth/changer-mot-de-passe')

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  // Compteurs personnalisés selon le rôle
  const [
    { count: omEnCours },
    { count: congesEnAttente },
    { count: demandesEnCours },
    { count: notifsNonLues },
  ] = await Promise.all([
    supabase.from('missions').select('*', { count: 'exact', head: true }).eq('status', 'en_mission'),
    supabase.from('conges').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('demandes_paiement').select('*', { count: 'exact', head: true }).not('status', 'in', '(autorise,rejete_aaf,rejete_caf,refuse_caf,refuse_de)'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('lu', false),
  ])

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrateur système', rh: 'Ressources Humaines',
    caf: 'CAF — Comptable', de: 'Directeur Exécutif', aaf: 'AAF',
    administrateur: 'Administrateur (CA)', manager: 'Manager',
    missionnaire: 'Missionnaire', prestataire: 'Prestataire',
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <AccueilClient
        prenom={profile?.prenoms ?? ''}
        role={role}
        roleLabel={ROLE_LABELS[role] ?? role}
        fonction={profile?.fonction ?? null}
        omEnCours={omEnCours ?? 0}
        congesEnAttente={congesEnAttente ?? 0}
        demandesEnCours={demandesEnCours ?? 0}
        notifsNonLues={notifsNonLues ?? 0}
      />
    </>
  )
}
