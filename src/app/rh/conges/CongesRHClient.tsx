'use client'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

type Conge = {
  id: string; statut: string; date_debut: string; date_fin: string; nb_jours: number | null
  motif: string | null; created_at: string; commentaire_valideur: string | null
  profile: { nom: string; prenoms: string; direction: string | null } | null
  type_conge: { nom: string } | null
}

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente (RH)', color: '#92400e', bg: '#fef3c7' },
  approuve_n1: { label: 'Validé RH — attente DE', color: '#1e40af', bg: '#dbeafe' },
  approuve: { label: 'Autorisé (DE)', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Rejeté', color: '#991b1b', bg: '#fee2e2' },
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none',
}

export default function CongesRHClient({ conges: initial, role }: { conges: Conge[]; role: string }) {
  const canValiderN1 = ['rh', 'admin'].includes(role)
  const canValiderFinal = ['de', 'administrateur', 'admin'].includes(role)
  const [conges, setConges] = useState(initial)
  const [filterStatut, setFilterStatut] = useState('')
  const [page, setPage] = useState(1)
  const [actionTarget, setActionTarget] = useState<Conge | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = conges.filter(c => !filterStatut || c.statut === filterStatut)

  async function valider(action: 'approuver' | 'rejeter', niveau: 'n1' | 'final') {
    if (!actionTarget) return
    setLoading(true)
    const res = await fetch(`/api/conges/${actionTarget.id}/valider`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, niveau, commentaire }),
    })
    setLoading(false)
    if (res.ok) {
      const d = await res.json()
      setConges(cs => cs.map(c => c.id === actionTarget.id ? { ...c, ...d.conge } : c))
      setActionTarget(null); setCommentaire('')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Congés ({filtered.length})</h2>
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employé', 'Type', 'Période', 'Jours', 'Motif', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginate(filtered, page).map((c, i) => {
              const s = STATUT[c.statut] ?? { label: c.statut, color: '#374151', bg: '#f3f4f6' }
              const canAct = (c.statut === 'en_attente' && canValiderN1) || (c.statut === 'approuve_n1' && canValiderFinal)
              const niveau: 'n1' | 'final' = c.statut === 'en_attente' ? 'n1' : 'final'
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.profile?.prenoms} {c.profile?.nom}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.type_conge?.nom ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.date_debut} → {c.date_fin}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700 }}>{c.nb_jours ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 150 }}>{c.motif ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {canAct && (
                      <button onClick={() => { setActionTarget(c); setCommentaire('') }} style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6, background: 'white', border: '1px solid var(--abed-border)', color: '#374151' }}>
                        Traiter
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun congé</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} total={filtered.length} onChange={p => { setPage(p) }} />
      </div>

      {actionTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 420 }}>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>
              {actionTarget.statut === 'en_attente' ? 'Valider la demande (RH)' : 'Autoriser la demande (DE)'}
            </h3>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
              <strong>{actionTarget.profile?.prenoms} {actionTarget.profile?.nom}</strong> — {actionTarget.type_conge?.nom ?? 'Congé'}
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {actionTarget.date_debut} → {actionTarget.date_fin} ({actionTarget.nb_jours}j)
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Commentaire (facultatif)</label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--abed-border)', outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setActionTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={() => valider('rejeter', actionTarget.statut === 'en_attente' ? 'n1' : 'final')} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
                Rejeter
              </button>
              <button onClick={() => valider('approuver', actionTarget.statut === 'en_attente' ? 'n1' : 'final')} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
                Approuver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
