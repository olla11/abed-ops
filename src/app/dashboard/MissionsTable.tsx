'use client'
import Link from 'next/link'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

type Mission = {
  id: string
  reference: string | null
  objet: string
  lieu: string
  date_depart: string
  date_retour: string
  status: string
  missionnaire?: { nom: string; prenoms: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', soumis: 'Soumis', signe: 'Signé',
  en_mission: 'En mission', reconciliation: 'Réconciliation',
  reconciliation_caf: 'Validation CAF', paiement_attente: 'Paiement en attente',
  cloture: 'Clôturé', rejete: 'Rejeté',
}

export default function MissionsTable({ missions, isManager }: { missions: Mission[]; isManager: boolean }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = missions.filter(m =>
    !search || m.objet.toLowerCase().includes(search.toLowerCase()) ||
    (m.reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
    m.lieu.toLowerCase().includes(search.toLowerCase()) ||
    `${(m.missionnaire as any)?.prenoms} ${(m.missionnaire as any)?.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  const paged = paginate(filtered, page)

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Rechercher (référence, objet, lieu…)"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--abed-border)', fontSize: 13, outline: 'none', width: '100%', maxWidth: 340, boxSizing: 'border-box' }}
        />
      </div>
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
            {paged.map(m => (
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
            {paged.length === 0 && (
              <tr><td colSpan={isManager ? 7 : 6} style={{ color: 'var(--abed-muted)' }}>Aucune mission.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filtered.length} onChange={setPage} />
    </>
  )
}
