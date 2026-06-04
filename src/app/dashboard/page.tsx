export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const isManager = ['admin', 'rh', 'caf', 'de'].includes(role)

  // caf/de/admin voient toutes les missions (RLS le gère, mais on trie différemment)
  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: notifs } = await supabase
    .from('notifications').select('*').eq('lu', false)
    .order('created_at', { ascending: false }).limit(5)

  const STATUS_LABELS: Record<string, string> = {
    brouillon: 'Brouillon',
    soumis: 'Soumis',
    signe: 'Signé',
    en_mission: 'En mission',
    reconciliation: 'Réconciliation',
    reconciliation_caf: 'Validation CAF',
    paiement_attente: 'Paiement en attente',
    cloture: 'Clôturé',
    rejete: 'Rejeté',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={role === 'admin'}
      />

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
        <h3 style={{ marginBottom: 16 }}>
          {isManager ? 'Tous les ordres de mission' : 'Mes ordres de mission'}
        </h3>
        <div className="table-wrap">
        <table style={{ minWidth: isManager ? 900 : 750 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {isManager && <col style={{ width: 160 }} />}
            <col style={{ width: isManager ? 280 : 340 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Référence</th>
              {isManager && <th>Missionnaire</th>}
              <th>Objet</th>
              <th>Lieu</th>
              <th>Période</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(missions ?? []).map(m => (
              <tr key={m.id}>
                <td title={m.reference ?? '—'}>{m.reference ?? '—'}</td>
                {isManager && (
                  <td style={{ fontSize: 13 }} title={`${(m.missionnaire as any)?.prenoms} ${(m.missionnaire as any)?.nom}`}>
                    {(m.missionnaire as any)?.prenoms} {(m.missionnaire as any)?.nom}
                  </td>
                )}
                <td title={m.objet}>{m.objet}</td>
                <td title={m.lieu}>{m.lieu}</td>
                <td style={{ fontSize: 12 }}>
                  {new Date(m.date_depart).toLocaleDateString('fr-FR')} → {new Date(m.date_retour).toLocaleDateString('fr-FR')}
                </td>
                <td><span className={`badge ${m.status}`}>{STATUS_LABELS[m.status] ?? m.status}</span></td>
                <td><Link href={`/missions/${m.id}`} style={{ fontSize: 13 }}>Ouvrir</Link></td>
              </tr>
            ))}
            {(!missions || missions.length === 0) && (
              <tr><td colSpan={isManager ? 7 : 6} style={{ color: 'var(--abed-muted)' }}>Aucune mission.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
