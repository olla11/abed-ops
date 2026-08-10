export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { getCachedProfile } from '@/lib/cache'
import ComptesTableClient from './ComptesTableClient'
import TitresPrincipauxAlert from './TitresPrincipauxAlert'

// Inclut les archivés pour l'admin
const getAllUsers = unstable_cache(
  async () => {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await service
      .from('profiles')
      .select('id, civilite, nom, prenoms, email, telephone, role, fonction, type_emploi, manager_id, archived, archived_at, archived_reason')
      .order('nom')
    return data ?? []
  },
  ['all-users-admin'],
  { tags: ['profiles', 'personnel'], revalidate: 300 }
)

export default async function ComptesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profile, users] = await Promise.all([
    getCachedProfile(user!.id),
    getAllUsers(),
  ])

  const managers = (users ?? []).filter((u: any) => !u.archived && ['manager', 'caf', 'de', 'dp', 'aaf', 'rh', 'admin', 'administrateur'].includes(u.role ?? ''))
  const canManage = ['admin', 'de', 'dp', 'superadmin'].includes(profile?.role ?? '')
  const isAdmin = ['admin', 'superadmin'].includes(profile?.role ?? '')
  const isSuperadmin = profile?.role === 'superadmin'

  return (
    <div className="page-container" style={{ display: 'grid', gap: 24 }}>
      {isAdmin && <TitresPrincipauxAlert />}
      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>Tous les comptes ({users?.length ?? 0})</h3>
        {canManage && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
            La colonne « Responsable » permet d'assigner un manager à chaque prestataire pour qu'il puisse soumettre ses timesheets.
          </p>
        )}
        {isSuperadmin && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
            La colonne « Changer le rôle » n'est visible que pour vous (superadmin). Un seul compte peut porter le rôle superadmin à la fois.
          </p>
        )}
        <ComptesTableClient
          users={users as any[]}
          managers={managers}
          canManage={canManage}
          isAdmin={isAdmin}
          isSuperadmin={isSuperadmin}
        />
      </div>
    </div>
  )
}
