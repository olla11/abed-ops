export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'

export default async function MissionsEnCours() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const isManager = ['admin', 'rh', 'caf', 'de', 'administrateur', 'aaf'].includes(role)

  const admin = createAdminClient()
  const query = admin
    .from('missions')
    .select(`
      id, reference, objet, lieu, date_depart, date_retour, status,
      missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)
    `)
    .eq('status', 'en_mission')
    .order('date_depart', { ascending: false })

  // Missionnaire : voir seulement ses propres missions en cours
  const { data: missions } = isManager
    ? await query
    : await query.eq('missionnaire_id', user.id)

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
            <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Missions en cours</h2>
          </div>
          <span style={{
            background: '#dbeafe', color: '#1e40af', borderRadius: 999,
            padding: '4px 14px', fontSize: 13, fontWeight: 700,
          }}>
            {missions?.length ?? 0} mission{(missions?.length ?? 0) > 1 ? 's' : ''}
          </span>
        </div>

        {!missions || missions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
            <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucune mission en cours</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid var(--abed-border)' }}>
                  {isManager && <th style={th}>Missionnaire</th>}
                  <th style={th}>Référence</th>
                  <th style={th}>Objet</th>
                  <th style={th}>Lieu</th>
                  <th style={th}>Départ</th>
                  <th style={th}>Retour</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {missions.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {isManager && (
                      <td style={td}>
                        {(m.missionnaire as any)?.prenoms} {(m.missionnaire as any)?.nom}
                      </td>
                    )}
                    <td style={td}>
                      <span style={{ fontSize: 12, color: 'var(--abed-muted)', fontFamily: 'monospace' }}>
                        {m.reference ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.objet}
                    </td>
                    <td style={td}>{m.lieu}</td>
                    <td style={td}>{fmtDate(m.date_depart)}</td>
                    <td style={td}>{fmtDate(m.date_retour)}</td>
                    <td style={td}>
                      <Link href={`/missions/${m.id}`} className="btn secondary" style={{ fontSize: 12, padding: '4px 12px' }}>
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

const th: React.CSSProperties = {
  padding: '12px 16px', fontSize: 12, fontWeight: 700,
  color: '#6b7280', textAlign: 'left', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '12px 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle',
}
