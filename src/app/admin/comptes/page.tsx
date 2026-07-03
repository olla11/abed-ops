export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { getCachedProfile, getCachedPersonnel } from '@/lib/cache'
import AdminUserCreate from '../AdminUserCreate'
import ComptesTableClient from './ComptesTableClient'

export default async function ComptesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profile, users] = await Promise.all([
    getCachedProfile(user!.id),
    getCachedPersonnel(),
  ])

  const managers = (users ?? []).filter((u: any) => ['manager', 'caf', 'de', 'aaf', 'rh', 'admin', 'administrateur'].includes(u.role ?? ''))
  const canManage = ['admin', 'de'].includes(profile?.role ?? '')
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="page-container" style={{ display: 'grid', gap: 24 }}>
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Créer un compte</h3>
        <AdminUserCreate />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>Tous les comptes ({users?.length ?? 0})</h3>
        {canManage && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
            La colonne « Responsable » permet d'assigner un manager à chaque prestataire pour qu'il puisse soumettre ses timesheets.
          </p>
        )}
        <ComptesTableClient
          users={users as any[]}
          managers={managers}
          canManage={canManage}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
