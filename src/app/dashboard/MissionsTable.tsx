'use client'
import React from 'react'
import Link from 'next/link'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'
import { PenLine, Plane, FolderOpen } from 'lucide-react'

export type Mission = {
  id: string
  reference: string | null
  objet: string
  lieu: string
  date_depart: string
  date_retour: string
  status: string
  missionnaire_id: string
  missionnaire?: { nom: string; prenoms: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', soumis: 'Soumis', signe: 'Signé',
  en_mission: 'En mission', reconciliation: 'Réconciliation',
  reconciliation_caf: 'Validation CAF', paiement_attente: 'Paiement en attente',
  cloture: 'Clôturé', rejete: 'Rejeté',
}

function MissionsTableSimple({ missions, showMissionnaire }: { missions: Mission[]; showMissionnaire: boolean }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = missions.filter(m =>
    !search ||
    m.objet.toLowerCase().includes(search.toLowerCase()) ||
    (m.reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
    m.lieu.toLowerCase().includes(search.toLowerCase()) ||
    `${(m.missionnaire as any)?.prenoms} ${(m.missionnaire as any)?.nom}`.toLowerCase().includes(search.toLowerCase())
  )
  const paged = paginate(filtered, page, 10)

  return (
    <>
      <input
        placeholder="Rechercher (référence, objet, lieu…)"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
        style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--abed-border)', fontSize: 13, outline: 'none', width: '100%', maxWidth: 340, marginBottom: 12, boxSizing: 'border-box' }}
      />
      <div className="table-wrap">
        <table style={{ minWidth: showMissionnaire ? 900 : 750 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {showMissionnaire && <col style={{ width: 160 }} />}
            <col style={{ width: showMissionnaire ? 260 : 340 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
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
            {paged.map(m => (
              <tr key={m.id}>
                <td title={m.reference ?? '—'} style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.reference ?? '—'}</td>
                {showMissionnaire && (
                  <td style={{ fontSize: 13 }}>
                    {(m.missionnaire as any)?.prenoms} {(m.missionnaire as any)?.nom}
                  </td>
                )}
                <td title={m.objet}>{m.objet}</td>
                <td title={m.lieu}>{m.lieu}</td>
                <td style={{ fontSize: 12 }}>
                  {new Date(m.date_depart).toLocaleDateString('fr-FR')} → {new Date(m.date_retour).toLocaleDateString('fr-FR')}
                </td>
                <td><span className={`badge ${m.status}`}>{STATUS_LABELS[m.status] ?? m.status}</span></td>
                <td><Link href={`/missions/${m.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ouvrir</Link></td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={showMissionnaire ? 7 : 6} style={{ color: 'var(--abed-muted)', textAlign: 'center', padding: '28px 0' }}>
                  Aucune mission.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filtered.length} pageSize={10} onChange={setPage} />
    </>
  )
}

type Tab = 'signer' | 'mes' | 'tous'

export default function MissionsTable({
  missions,
  isManager,
  isSignataire,
  userId,
}: {
  missions: Mission[]
  isManager: boolean
  isSignataire: boolean
  userId: string
}) {
  const [tab, setTab] = useState<Tab>(isSignataire ? 'signer' : 'mes')

  if (!isSignataire) {
    // Vue simple : missionnaire standard, manager non-signataire (rh)
    return <MissionsTableSimple missions={missions} showMissionnaire={isManager && !isSignataire} />
  }

  // Vue signataire : onglets
  const aSignerMissions = missions.filter(m => m.status === 'soumis' && m.missionnaire_id !== userId)
  const mesMissions = missions.filter(m => m.missionnaire_id === userId)

  const tabs: { key: Tab; label: string; count?: number; icon: React.ElementType; color?: string }[] = [
    { key: 'signer', label: 'À signer', count: aSignerMissions.length, icon: PenLine, color: aSignerMissions.length > 0 ? '#b45309' : undefined },
    { key: 'mes', label: 'Mes ordres de mission', icon: Plane },
    { key: 'tous', label: 'Tous les ordres', icon: FolderOpen },
  ]

  return (
    <div>
      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--abed-border)', paddingBottom: 0 }}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px', fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? 'var(--abed-green)' : (t.color ?? '#6b7280'),
                borderBottom: active ? '2px solid var(--abed-green)' : '2px solid transparent',
                marginBottom: -2, display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              <t.icon size={15} strokeWidth={2} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{
                  background: t.count > 0 ? '#fef3c7' : '#f3f4f6',
                  color: t.count > 0 ? '#92400e' : '#9ca3af',
                  borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700,
                  border: t.count > 0 ? '1px solid #fcd34d' : '1px solid #e5e7eb',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Contenu onglet À signer */}
      {tab === 'signer' && (
        <div>
          {aSignerMissions.length > 0 ? (
            <>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⏳</span>
                <div>
                  <strong style={{ fontSize: 14, color: '#92400e' }}>{aSignerMissions.length} ordre{aSignerMissions.length > 1 ? 's' : ''} en attente de votre signature</strong>
                  <p style={{ fontSize: 12, color: '#b45309', margin: '2px 0 0' }}>
                    Ces missions ont été soumises et nécessitent votre signature pour être officialisées.
                  </p>
                </div>
              </div>
              <MissionsTableSimple missions={aSignerMissions} showMissionnaire={true} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucun ordre en attente</p>
              <p style={{ fontSize: 13 }}>Toutes les demandes de mission soumises ont été traitées.</p>
            </div>
          )}
        </div>
      )}

      {/* Contenu onglet Mes missions */}
      {tab === 'mes' && (
        <div>
          {mesMissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucune mission personnelle</p>
              <p style={{ fontSize: 13 }}>Vous n'avez pas encore soumis d'ordre de mission.</p>
            </div>
          ) : (
            <MissionsTableSimple missions={mesMissions} showMissionnaire={false} />
          )}
        </div>
      )}

      {/* Contenu onglet Tous les ordres */}
      {tab === 'tous' && (
        <MissionsTableSimple missions={missions} showMissionnaire={true} />
      )}
    </div>
  )
}
