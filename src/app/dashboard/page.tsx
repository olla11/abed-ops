export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: notifs } = await supabase
    .from('notifications').select('*').eq('lu', false)
    .order('created_at', { ascending: false }).limit(5)

  const role = profile?.role ?? 'missionnaire'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, color: 'var(--abed-green)' }}>ABED-ONG</h1>
          <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>
            {profile?.prenoms} {profile?.nom} · {role.toUpperCase()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/missions/nouveau" className="btn">+ Demander un OM</Link>
          <Link href="/timesheets" className="btn secondary">Timesheets</Link>
          {(role === 'admin' || role === 'rh' || role === 'caf') && (
            <Link href="/admin" className="btn secondary">Admin</Link>
          )}
        </div>
      </header>

      {notifs && notifs.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--abed-amber)' }}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Notifications</h3>
          {notifs.map(n => (
            <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--abed-border)' }}>
              <strong style={{ fontSize: 14 }}>{n.titre}</strong>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>{n.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Ordres de mission</h3>
        <table>
          <thead>
            <tr><th>Référence</th><th>Objet</th><th>Lieu</th><th>Période</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {(missions ?? []).map(m => (
              <tr key={m.id}>
                <td>{m.reference ?? '—'}</td>
                <td>{m.objet}</td>
                <td>{m.lieu}</td>
                <td style={{ fontSize: 13 }}>
                  {new Date(m.date_depart).toLocaleDateString('fr-FR')} → {new Date(m.date_retour).toLocaleDateString('fr-FR')}
                </td>
                <td><span className={`badge ${m.status}`}>{m.status}</span></td>
                <td><Link href={`/missions/${m.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
            {(!missions || missions.length === 0) && (
              <tr><td colSpan={6} style={{ color: 'var(--abed-muted)' }}>Aucune mission.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}