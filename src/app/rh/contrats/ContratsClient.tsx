'use client'
import { useState } from 'react'

type Contrat = {
  id: string; profile_id: string; type_contrat: string; poste: string | null
  direction: string | null; date_debut: string; date_fin: string | null
  statut: string; salaire_brut: number | null; observations: string | null
  profile: { id: string; nom: string; prenoms: string; email: string | null; role: string } | null
}
type Personnel = { id: string; nom: string; prenoms: string; role: string; fonction: string | null }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const TYPES = ['CDD', 'CDI', 'Stage', 'Bénévolat', 'Prestataire', 'Consultant']

function statutBadge(statut: string, dateFin: string | null) {
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  if (statut === 'resilie') return { label: 'Résilié', bg: '#f3f4f6', color: '#6b7280' }
  if (statut === 'expire' || (dateFin && dateFin < today)) return { label: 'Expiré', bg: '#fee2e2', color: '#991b1b' }
  if (dateFin && dateFin <= in7) return { label: 'Expire J-' + Math.ceil((new Date(dateFin).getTime() - Date.now()) / 86400000), bg: '#fef2f2', color: '#dc2626' }
  if (dateFin && dateFin <= in30) return { label: 'Expire bientôt', bg: '#fef3c7', color: '#92400e' }
  return { label: 'Actif', bg: '#dcfce7', color: '#166534' }
}

// Modal défini HORS du composant parent pour éviter le démontage à chaque frappe
function Modal({ title, onSubmit, onClose, loading, err, children }: {
  title: string; onSubmit: () => void; onClose: () => void
  loading: boolean; err: string | null; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>{title}</h3>
        {children}
        {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
          <button onClick={onSubmit} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
            {loading ? '...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContratsClient({ contrats: initial, personnel }: { contrats: Contrat[]; personnel: Personnel[] }) {
  const [contrats, setContrats] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [search, setSearch] = useState('')

  const filtered = contrats.filter(c => {
    const q = search.toLowerCase()
    const name = `${c.profile?.prenoms ?? ''} ${c.profile?.nom ?? ''}`.toLowerCase()
    return (!q || name.includes(q) || (c.poste ?? '').toLowerCase().includes(q)) &&
      (!filterStatut || c.statut === filterStatut)
  })

  function handleEmployeChange(profileId: string) {
    const p = personnel.find(x => x.id === profileId)
    setForm((f: any) => ({ ...f, profile_id: profileId, poste: p?.fonction ?? f.poste ?? '' }))
  }

  async function createContrat() {
    setLoading(true); setErr(null)
    const res = await fetch('/api/rh/contrats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) {
      setShowNew(false); setForm({})
      const d = await res.json()
      setContrats(c => [d.contrat, ...c])
    } else {
      const d = await res.json(); setErr(d.error ?? 'Erreur')
    }
  }

  async function renouveler() {
    if (!renewTarget) return
    setLoading(true); setErr(null)
    const res = await fetch(`/api/rh/contrats/${renewTarget.id}/renouveler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_debut: form.date_debut, date_fin: form.date_fin }),
    })
    setLoading(false)
    if (res.ok) {
      setRenewTarget(null); setForm({})
      location.reload()
    } else {
      const d = await res.json(); setErr(d.error ?? 'Erreur')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Contrats ({filtered.length})</h2>
        <button onClick={() => { setShowNew(true); setForm({}); setErr(null) }} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}>
          + Nouveau contrat
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }} />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="expire">Expiré</option>
          <option value="resilie">Résilié</option>
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employé', 'Type', 'Poste', 'Début', 'Fin', 'Statut', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const badge = statutBadge(c.statut, c.date_fin)
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.profile?.prenoms} {c.profile?.nom}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.type_contrat}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{c.poste ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.date_debut}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.date_fin ?? 'Indéterminée'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.statut !== 'actif' && (
                      <button onClick={() => { setRenewTarget(c); setForm({}); setErr(null) }} style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6, background: 'white', border: '1px solid var(--abed-border)', color: '#374151' }}>
                        Renouveler
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun contrat</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="Nouveau contrat" onSubmit={createContrat} onClose={() => { setShowNew(false); setErr(null) }} loading={loading} err={err}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Employé *</label>
            <select value={form.profile_id ?? ''} onChange={e => handleEmployeChange(e.target.value)} style={inputStyle}>
              <option value="">— Choisir —</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type *</label>
            <select value={form.type_contrat ?? ''} onChange={e => setForm((f: any) => ({ ...f, type_contrat: e.target.value }))} style={inputStyle}>
              <option value="">— Choisir —</option>
              {TYPES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Poste</label>
            <input value={form.poste ?? ''} onChange={e => setForm((f: any) => ({ ...f, poste: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Direction</label>
            <input value={form.direction ?? ''} onChange={e => setForm((f: any) => ({ ...f, direction: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date début *</label>
              <input type="date" value={form.date_debut ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date fin</label>
              <input type="date" value={form.date_fin ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Salaire brut (FCFA)</label>
            <input type="number" value={form.salaire_brut ?? ''} onChange={e => setForm((f: any) => ({ ...f, salaire_brut: e.target.value }))} style={inputStyle} />
          </div>
        </Modal>
      )}

      {renewTarget && (
        <Modal title={`Renouveler — ${renewTarget.profile?.prenoms} ${renewTarget.profile?.nom}`} onSubmit={renouveler} onClose={() => { setRenewTarget(null); setErr(null) }} loading={loading} err={err}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Contrat {renewTarget.type_contrat} — Expiré le {renewTarget.date_fin}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nouveau début *</label>
              <input type="date" value={form.date_debut ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nouvelle fin</label>
              <input type="date" value={form.date_fin ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
