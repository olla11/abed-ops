'use client'
import { useState } from 'react'
import Link from 'next/link'
import { STATUT_LABELS, type OpportuniteStatut } from '@/lib/bd'

type Opportunite = {
  id: string
  titre: string
  bailleur: string | null
  statut: OpportuniteStatut
  date_identification: string
  date_limite: string | null
  date_soumission: string | null
  identifie_par: { nom: string; prenoms: string } | null
}

const STATUT_BADGE: Record<OpportuniteStatut, { color: string; bg: string; border: string }> = {
  identifie: { color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' },
  en_preparation: { color: '#92660b', bg: '#fffbeb', border: '#fde68a' },
  soumis: { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  accepte: { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  refuse: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  sans_reponse: { color: '#57534e', bg: '#f5f5f4', border: '#e7e5e4' },
  abandonne: { color: '#57534e', bg: '#f5f5f4', border: '#e7e5e4' },
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

export default function OpportunitesListClient({ opportunites }: { opportunites: Opportunite[] }) {
  const [filtre, setFiltre] = useState<OpportuniteStatut | 'tous'>('tous')

  const filtered = filtre === 'tous' ? opportunites : opportunites.filter(o => o.statut === filtre)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFiltre('tous')} style={filterBtnStyle(filtre === 'tous')}>
          Tous ({opportunites.length})
        </button>
        {(Object.keys(STATUT_LABELS) as OpportuniteStatut[]).map(s => {
          const count = opportunites.filter(o => o.statut === s).length
          if (count === 0) return null
          return (
            <button key={s} onClick={() => setFiltre(s)} style={filterBtnStyle(filtre === s)}>
              {STATUT_LABELS[s]} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--abed-muted)' }}>Aucune opportunité.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(o => {
            const badge = STATUT_BADGE[o.statut]
            return (
              <Link key={o.id} href={`/bd/opportunites/${o.id}`} className="card" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textDecoration: 'none', color: 'inherit', padding: '14px 18px', gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.titre}</div>
                  <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                    {o.bailleur ?? 'Bailleur non précisé'}
                    {o.identifie_par && ` — identifiée par ${o.identifie_par.prenoms} ${o.identifie_par.nom}`}
                    {o.date_limite && ` — échéance ${fmtDate(o.date_limite)}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: badge.color, background: badge.bg,
                  border: `1px solid ${badge.border}`, borderRadius: 20, padding: '3px 12px', flexShrink: 0,
                }}>
                  {STATUT_LABELS[o.statut]}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--abed-green)' : 'white', color: active ? 'white' : '#374151',
    border: `1px solid ${active ? 'var(--abed-green)' : '#e5e7eb'}`,
  }
}
