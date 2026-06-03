export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GestionTitres from '@/components/GestionTitres'
import AdminUserCreate from './AdminUserCreate'
import UserDeleteButton from './UserDeleteButton'
import ManagerAssignSelect from '@/components/ManagerAssignSelect'
import AdminStorage from '@/components/AdminStorage'
import AppHeader from '@/components/AppHeader'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, nom, prenoms, email, role, telephone, fonction, civilite, manager_id')
    .order('nom')

  // Managers disponibles (manager, caf, de, admin)
  const managers = (users ?? []).filter(u => ['manager', 'caf', 'de', 'admin'].includes(u.role ?? ''))

  const canManage = ['admin', 'caf'].includes(profile?.role ?? '')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        showAdmin={true}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Administration — Comptes &amp; Titres</h2>
      </div>

      {profile?.role === 'admin' && <AdminStorage />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Créer un compte</h3>
          <AdminUserCreate />
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Attribuer un titre</h3>
          <GestionTitres />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>Tous les comptes ({users?.length ?? 0})</h3>
        {canManage && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
            La colonne « Responsable » permet d'assigner un manager à chaque prestataire pour qu'il puisse soumettre ses timesheets.
          </p>
        )}
        <div className="table-wrap">
        <table style={{ minWidth: 1000 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 140 }} />
            {canManage && <col style={{ width: 210 }} />}
            {profile?.role === 'admin' && <col style={{ width: 80 }} />}
          </colgroup>
          <thead>
            <tr>
              <th>Civ.</th>
              <th>Nom &amp; Prénoms</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Rôle</th>
              <th>Fonction</th>
              {canManage && <th>Responsable direct</th>}
              {profile?.role === 'admin' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id}>
                <td style={{ fontSize: 12 }}>{(u as any).civilite ?? 'M.'}</td>
                <td style={{ fontWeight: 600 }} title={`${u.nom} ${u.prenoms}`}>{u.nom} {u.prenoms}</td>
                <td style={{ fontSize: 12 }} title={u.email}>{u.email}</td>
                <td style={{ fontSize: 12 }}>{u.telephone ?? '—'}</td>
                <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                <td style={{ fontSize: 12 }} title={u.fonction ?? ''}>{u.fonction ?? '—'}</td>
                {canManage && (
                  <td>
                    <ManagerAssignSelect
                      userId={u.id}
                      currentManagerId={(u as any).manager_id ?? null}
                      managers={managers.filter(m => m.id !== u.id)}
                    />
                  </td>
                )}
                {profile?.role === 'admin' && (
                  <td><UserDeleteButton userId={u.id} name={`${u.prenoms} ${u.nom}`} /></td>
                )}
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr><td colSpan={8} style={{ color: 'var(--abed-muted)' }}>Aucun compte.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
