'use client'
import Link from 'next/link'
import { useState } from 'react'
import TabBar from './TabBar'

type Mission = {
  id: string; reference: string | null; objet: string; lieu: string
  date_depart: string; date_retour: string; status: string
  missionnaire_id: string
  missionnaire: { nom: string; prenoms: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', soumis: 'Soumis', signe: 'Signé',
  en_mission: 'En mission', reconciliation: 'Réconciliation',
  reconciliation_caf: 'Validation CAF', paiement_attente: 'Paiement en attente',
  cloture: 'Clôturé', rejete: 'Rejeté',
}

// Statuts qui demandent une action du gestionnaire
const ACTIONABLE = ['soumis', 'reconciliation', 'reconciliation_caf', 'paiement_attente']

function MissionTable({ missions, showMissionnaire }: { missions: Mission[]; showMissionnaire: boolean }) {
  if (missions.length === 0) {
    return <p style={{ color: 'var(--abed-muted)', padding: '20px 0' }}>Aucune mission.</p>
  }
  return (
    <div className="table-wrap">
      <table style={{ minWidth: showMissionnaire ? 900 : 750 }}>
        <colgroup>
          <col style={{ width: 160 }} />
          {showMissionnaire && <col style={{ width: 160 }} />}
          <col style={{ width: showMissionnaire ? 260 : 340 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Référence</th>
            {showMissionnaire && <th>Missionnaire</th>}
            <th>Objet</th>
            <th>Lieu</th>
            <th>Période</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {missions.map(m => (
            <tr key={m.id}>
              <td title={m.reference ?? '—'}>{m.reference ?? '—'}</td>
              {showMissionnaire && (
                <td style={{ fontSize: 13 }}>
                  {m.missionnaire?.prenoms} {m.missionnaire?.nom}
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
        </tbody>
      </table>
    </div>
  )
}

export default function DashboardTabs({
  missions, userId, isManager, notifs,
}: {
  missions: Mission[]
  userId: string
  isManager: boolean
  notifs: { id: string; titre: string; message: string }[]
}) {
  const mesMissions = missions.filter(m => m.missionnaire_id === userId)
  const aTraiter = missions.filter(m => m.missionnaire_id !== userId && ACTIONABLE.includes(m.status))
  const autresMissions = missions.filter(m => m.missionnaire_id !== userId && !ACTIONABLE.includes(m.status))

  const tabs = isManager
    ? [
        { key: 'mes', label: 'Mes OMs' },
        { key: 'traiter', label: 'À traiter', count: aTraiter.length },
        { key: 'tous', label: 'Historique équipe' },
      ]
    : []

  const [activeTab, setActiveTab] = useState('mes')

  return (
    <div>
      {notifs.length > 0 && (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>Ordres de mission</h2>
          <Link href="/missions/nouveau" className="btn" style={{ fontSize: 13 }}>+ Nouvel OM</Link>
        </div>

        {isManager ? (
          <>
            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

            {activeTab === 'mes' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                  Vos propres ordres de mission.
                </p>
                <MissionTable missions={mesMissions} showMissionnaire={false} />
              </>
            )}

            {activeTab === 'traiter' && (
              <>
                {aTraiter.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--abed-muted)' }}>
                    ✅ Aucun ordre de mission en attente de traitement.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                      OMs soumis ou en attente d'une action de votre part.
                    </p>
                    <MissionTable missions={aTraiter} showMissionnaire={true} />
                  </>
                )}
              </>
            )}

            {activeTab === 'tous' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                  Tous les OMs de l'équipe (hors en attente de traitement).
                </p>
                <MissionTable missions={autresMissions} showMissionnaire={true} />
              </>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
              Vos ordres de mission soumis et leur avancement.
            </p>
            <MissionTable missions={mesMissions} showMissionnaire={false} />
          </>
        )}
      </div>
    </div>
  )
}
