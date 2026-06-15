export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import AdminUserCreate from '../AdminUserCreate'
import UserDeleteButton from '../UserDeleteButton'
import ManagerAssignSelect from '@/components/ManagerAssignSelect'

export default async function ComptesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, civilite, nom, prenoms, email, telephone, role, fonction, type_emploi, manager_id')
    .order('nom')

  const managers = (users ?? []).filter(u => ['manager', 'caf', 'de', 'aaf', 'rh', 'admin', 'administrateur'].includes(u.role ?? ''))
  const canManage = ['admin', 'de'].includes(profile?.role ?? '')
  const isAdmin = profile?.role === 'admin'

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Créer un compte</h3>
        <AdminUserCreate />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>Tous les comptes ({users?.length ?? 0})</h3>
        {canManage && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
            La colonne « Responsable » permet d'assigner un manager à chaque prestataire pour qu'il puisse soumettre ses timesheets.
          </p>
        )}
        <div className="table-wrap">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Civ.</th>
                <th>Nom &amp; Prénoms</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>Type emploi</th>
                <th>Fonction</th>
                {canManage && <th>Responsable direct</th>}
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id}>
                  <td style={{ fontSize: 12 }}>{(u as any).civilite ?? 'M.'}</td>
                  <td style={{ fontWeight: 600 }}>{u.prenoms} {u.nom}</td>
                  <td style={{ fontSize: 12 }}>{u.email}</td>
                  <td style={{ fontSize: 12 }}>{u.telephone ?? '—'}</td>
                  <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--abed-muted)' }}>{(u as any).type_emploi ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{u.fonction ?? '—'}</td>
                  {canManage && (
                    <td>
                      <ManagerAssignSelect
                        userId={u.id}
                        currentManagerId={(u as any).manager_id ?? null}
                        managers={managers.filter(m => m.id !== u.id)}
                      />
                    </td>
                  )}
                  {isAdmin && (
                    <td><UserDeleteButton userId={u.id} name={`${u.prenoms} ${u.nom}`} /></td>
                  )}
                </tr>
              ))}
              {(!users || users.length === 0) && (
                <tr><td colSpan={9} style={{ color: 'var(--abed-muted)' }}>Aucun compte.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
