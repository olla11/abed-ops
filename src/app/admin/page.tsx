export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GestionTitres from '@/components/GestionTitres'
import AdminUserCreate from './AdminUserCreate'
import UserDeleteButton from './UserDeleteButton'
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
    .select('id, nom, prenoms, email, role, telephone, fonction, civilite')
    .order('nom')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        showAdmin={true}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Administration — Comptes &amp; Titres</h2>
      </div>

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
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Tous les comptes ({users?.length ?? 0})</h3>
        <table>
          <thead>
            <tr>
              <th>Civilité</th>
              <th>Nom &amp; Prénoms</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Rôle</th>
              <th>Fonction</th>
              {profile?.role === 'admin' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id}>
                <td style={{ fontSize: 13 }}>{(u as any).civilite ?? 'M.'}</td>
                <td style={{ fontWeight: 600 }}>{u.nom} {u.prenoms}</td>
                <td style={{ fontSize: 13 }}>{u.email}</td>
                <td style={{ fontSize: 13 }}>{u.telephone ?? '—'}</td>
                <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                <td style={{ fontSize: 13 }}>{u.fonction ?? '—'}</td>
                {profile?.role === 'admin' && (
                  <td><UserDeleteButton userId={u.id} name={`${u.prenoms} ${u.nom}`} /></td>
                )}
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr><td colSpan={profile?.role === 'admin' ? 7 : 6} style={{ color: 'var(--abed-muted)' }}>Aucun compte.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
