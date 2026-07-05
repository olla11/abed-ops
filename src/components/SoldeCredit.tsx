'use client'
import { useEffect, useState } from 'react'

type Entry = {
  id: string
  titre: string
  mois: number
  annee: number
  heures: number
  montant: number
  status: string
  paye: boolean
}

type Paiement = {
  montant: number
  heures_payees: number | null
  note: string | null
  created_at: string
}

type SoldeData = {
  entries: Entry[]
  paiements: Paiement[]
  totalHeures: number
  totalMontant: number
  totalPaye: number
  resteADevoir: number
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SoldeCredit() {
  const [data, setData] = useState<SoldeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'heures' | 'versements'>('heures')

  useEffect(() => {
    fetch('/api/timesheets/mon-solde')
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#6b7280', fontSize: 14 }}>Chargement du solde…</p>
  if (!data) return <p style={{ color: '#ef4444', fontSize: 14 }}>Impossible de charger le solde.</p>

  const pct = data.totalMontant > 0 ? Math.min(100, Math.round((data.totalPaye / data.totalMontant) * 100)) : 0

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* Cartes résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatCard label="Heures validées" value={`${data.totalHeures} h`} color="#1e40af" bg="#dbeafe" />
        <StatCard label="Montant dû (CAF)" value={`${data.totalMontant.toLocaleString('fr-FR')} F`} color="#6d28d9" bg="#ede9fe" />
        <StatCard label="Total versé" value={`${data.totalPaye.toLocaleString('fr-FR')} F`} color="#166534" bg="#dcfce7" />
        <StatCard
          label="Reste à percevoir"
          value={`${data.resteADevoir.toLocaleString('fr-FR')} F`}
          color={data.resteADevoir > 0 ? '#b45309' : '#166534'}
          bg={data.resteADevoir > 0 ? '#fef3c7' : '#dcfce7'}
        />
      </div>

      {/* Barre de progression */}
      {data.totalMontant > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Taux de recouvrement</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 100 ? '#166534' : '#b45309' }}>{pct}%</span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 999,
              background: pct >= 100 ? '#16a34a' : '#f59e0b',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>
            {data.totalPaye.toLocaleString('fr-FR')} F versés sur {data.totalMontant.toLocaleString('fr-FR')} F validés
          </p>
        </div>
      )}

      {/* Onglets détail */}
      <div style={{ display: 'flex', gap: 8, marginBottom: -8 }}>
        {(['heures', 'versements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1.5px solid',
            borderColor: tab === t ? 'var(--abed-green)' : '#e5e7eb',
            background: tab === t ? 'var(--abed-green)' : 'white',
            color: tab === t ? 'white' : '#374151',
          }}>
            {t === 'heures' ? `Timesheets validés (${data.entries.filter(e => e.status === 'valide_caf').length})` : `Versements reçus (${data.paiements.length})`}
          </button>
        ))}
      </div>

      {/* Tableau timesheets */}
      {tab === 'heures' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {data.entries.filter(e => e.status === 'valide_caf').length === 0 ? (
            <p style={{ padding: '24px', color: '#9ca3af', textAlign: 'center', fontSize: 14 }}>
              Aucun timesheet validé par la CAF pour le moment.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Période', 'Titre', 'Heures', 'Montant'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.filter(e => e.status === 'valide_caf').map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {MOIS[(e.mois ?? 1) - 1]} {e.annee}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#111827' }}>{e.titre}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#1e40af' }}>{e.heures} h</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#166534' }}>
                      {e.montant.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tableau versements */}
      {tab === 'versements' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {data.paiements.length === 0 ? (
            <p style={{ padding: '24px', color: '#9ca3af', textAlign: 'center', fontSize: 14 }}>
              Aucun versement reçu pour le moment.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date', 'Montant', 'Heures', 'Note'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.paiements.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDate(p.created_at)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#166534' }}>
                      {Number(p.montant).toLocaleString('fr-FR')} F
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>
                      {p.heures_payees ? `${p.heures_payees} h` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>{p.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}
