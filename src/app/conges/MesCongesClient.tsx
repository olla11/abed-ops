'use client'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

type Conge = { id: string; statut: string; date_debut: string; date_fin: string; nb_jours: number | null; motif: string | null; created_at: string; type_conge: { nom: string } | null }
type TypeConge = { id: string; nom: string; jours_annuels: number }
type Solde = { type_conge_id: string; jours_acquis: number; jours_pris: number; type_conge: { nom: string } | null; annee: number }

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente (RH)', color: '#92400e', bg: '#fef3c7' },
  approuve_n1: { label: 'Validé RH — attente DE', color: '#1e40af', bg: '#dbeafe' },
  approuve: { label: 'Autorisé', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Rejeté', color: '#991b1b', bg: '#fee2e2' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

export default function MesCongesClient({ conges: initial, typesConge, soldes, hasManager }: { conges: Conge[]; typesConge: TypeConge[]; soldes: Solde[]; hasManager: boolean }) {
  const [conges, setConges] = useState(initial)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type_conge_id: '', date_debut: '', date_fin: '', motif: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setLoading(true); setErr(null)
    const res = await fetch('/api/conges', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      const d = await res.json()
      setConges(c => [d.conge, ...c])
      setShowForm(false)
      setForm({ type_conge_id: '', date_debut: '', date_fin: '', motif: '' })
    } else {
      const d = await res.json(); setErr(d.error ?? 'Erreur')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Mes congés</h2>
        <button onClick={() => { setShowForm(true); setErr(null) }} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}>
          + Demande de congé
        </button>
      </div>

      {/* Soldes */}
      {soldes.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {soldes.map(s => {
            const solde = s.jours_acquis - s.jours_pris
            return (
              <div key={s.type_conge_id} style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '14px 20px', minWidth: 160 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.type_conge?.nom}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: solde > 5 ? 'var(--abed-green)' : '#f59e0b' }}>{solde}j</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.jours_acquis}j acquis · {s.jours_pris}j pris</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Liste */}
      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Type', 'Période', 'Jours', 'Motif', 'Statut'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginate(conges, page).map((c, i) => {
              const s = STATUT[c.statut] ?? { label: c.statut, color: '#374151', bg: '#f3f4f6' }
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{c.type_conge?.nom ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.date_debut} → {c.date_fin}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700 }}>{c.nb_jours ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{c.motif ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                </tr>
              )
            })}
            {conges.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucune demande de congé</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} total={conges.length} onChange={setPage} />
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 420 }}>
            <h3 style={{ marginBottom: 20, fontSize: 16 }}>Nouvelle demande de congé</h3>
            {!hasManager && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#92400e' }}>
                ⚠️ Aucun responsable technique assigné à votre profil. Contactez les RH.
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type de congé *</label>
              <select value={form.type_conge_id} onChange={e => setForm(f => ({ ...f, type_conge_id: e.target.value }))} style={inputStyle}>
                <option value="">— Choisir —</option>
                {typesConge.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Début *</label>
                <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fin *</label>
                <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motif</label>
              <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
            </div>
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={submit} disabled={loading || !hasManager} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: (loading || !hasManager) ? .6 : 1 }}>
                {loading ? 'Envoi...' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
