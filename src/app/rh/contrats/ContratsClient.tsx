'use client'
import { useState } from 'react'

type Contrat = {
  id: string; profile_id: string; type_contrat: string; poste: string | null
  direction: string | null; date_debut: string; date_fin: string | null
  statut: string; salaire_brut: number | null; observations: string | null
  numero: string | null
  profile: { id: string; nom: string; prenoms: string; email: string | null; role: string } | null
}
type Personnel = { id: string; nom: string; prenoms: string; role: string; fonction: string | null }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const TYPES = ['CDD', 'CDI', 'Stage N1', 'Stage N2', 'Bénévolat', 'Prestataire direct', 'Prestataire à crédit', 'Consultant']
const DIRECTIONS = ['Administration', 'Direction Exécutive', 'Direction des Programmes', 'Exploitation', 'Autre']

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

function Modal({ title, onSubmit, onClose, loading, err, children }: {
  title: string; onSubmit: () => void; onClose: () => void
  loading: boolean; err: string | null; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
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
  const [editTarget, setEditTarget] = useState<Contrat | null>(null)
  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null)
  const [resilierTarget, setResilierTarget] = useState<Contrat | null>(null)
  const [form, setForm] = useState<any>({})
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [search, setSearch] = useState('')

  const filtered = contrats.filter(c => {
    const q = search.toLowerCase()
    const name = `${c.profile?.prenoms ?? ''} ${c.profile?.nom ?? ''}`.toLowerCase()
    return (!q || name.includes(q) || (c.poste ?? '').toLowerCase().includes(q) || (c.numero ?? '').toLowerCase().includes(q)) &&
      (!filterStatut || c.statut === filterStatut)
  })

  function handleEmployeChange(profileId: string) {
    const p = personnel.find(x => x.id === profileId)
    setForm((f: any) => ({ ...f, profile_id: profileId, poste: p?.fonction ?? f.poste ?? '' }))
  }

  function openEdit(c: Contrat) {
    setEditTarget(c)
    setForm({ type_contrat: c.type_contrat, poste: c.poste ?? '', direction: c.direction ?? '', date_debut: c.date_debut, date_fin: c.date_fin ?? '', salaire_brut: c.salaire_brut ?? '', observations: c.observations ?? '' })
    setErr(null)
  }

  async function createContrat() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/rh/contrats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        setShowNew(false); setForm({})
        setContrats(c => [d.contrat, ...c])
      } else {
        setErr(d.error ?? 'Erreur lors de la création')
      }
    } catch {
      setErr('Erreur réseau — veuillez réessayer')
    } finally {
      setLoading(false)
    }
  }

  async function updateContrat() {
    if (!editTarget) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${editTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (res.ok) {
        setContrats(cs => cs.map(c => c.id === editTarget.id ? { ...c, ...d.contrat } : c))
        setEditTarget(null); setForm({})
      } else {
        setErr(d.error ?? 'Erreur modification')
      }
    } catch {
      setErr('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function resilier() {
    if (!resilierTarget) return
    if (!motif || motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${resilierTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resilier', motif }),
      })
      const d = await res.json()
      if (res.ok) {
        setContrats(cs => cs.map(c => c.id === resilierTarget.id ? { ...c, statut: 'resilie' } : c))
        setResilierTarget(null); setMotif('')
      } else {
        setErr(d.error ?? 'Erreur résiliation')
      }
    } catch {
      setErr('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function renouveler() {
    if (!renewTarget) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${renewTarget.id}/renouveler`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_debut: form.date_debut, date_fin: form.date_fin }),
      })
      if (res.ok) { setRenewTarget(null); setForm({}); location.reload() }
      else { const d = await res.json(); setErr(d.error ?? 'Erreur') }
    } catch {
      setErr('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const contractFields = (
    <>
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
        <select value={form.direction ?? ''} onChange={e => setForm((f: any) => ({ ...f, direction: e.target.value }))} style={inputStyle}>
          <option value="">— Choisir —</option>
          {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
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
    </>
  )

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
        <div className="table-wrap">
          <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['N°', 'Employé', 'Type', 'Poste', 'Début', 'Fin', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const badge = statutBadge(c.statut, c.date_fin)
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{c.numero ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.profile?.prenoms} {c.profile?.nom}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{c.type_contrat}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.poste ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{c.date_debut}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{c.date_fin ?? 'Indéterminée'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <a href={`/api/contrat-pdf/${c.id}`} target="_blank" rel="noreferrer"
                          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          📄 Voir
                        </a>
                        {c.statut === 'actif' && (
                          <>
                            <button onClick={() => openEdit(c)}
                              style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6, background: 'white', border: '1px solid var(--abed-border)', color: '#374151', whiteSpace: 'nowrap' }}>
                              ✏️ Modifier
                            </button>
                            <button onClick={() => { setResilierTarget(c); setMotif(''); setErr(null) }}
                              style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6, background: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626', whiteSpace: 'nowrap' }}>
                              Résilier
                            </button>
                          </>
                        )}
                        {c.statut !== 'actif' && (
                          <button onClick={() => { setRenewTarget(c); setForm({}); setErr(null) }}
                            style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6, background: 'white', border: '1px solid var(--abed-border)', color: '#374151', whiteSpace: 'nowrap' }}>
                            Renouveler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun contrat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nouveau contrat */}
      {showNew && (
        <Modal title="Nouveau contrat" onSubmit={createContrat} onClose={() => { setShowNew(false); setErr(null) }} loading={loading} err={err}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Employé *</label>
            <select value={form.profile_id ?? ''} onChange={e => handleEmployeChange(e.target.value)} style={inputStyle}>
              <option value="">— Choisir —</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
            </select>
          </div>
          {contractFields}
        </Modal>
      )}

      {/* Modifier contrat */}
      {editTarget && (
        <Modal title={`Modifier — ${editTarget.profile?.prenoms} ${editTarget.profile?.nom}`} onSubmit={updateContrat} onClose={() => { setEditTarget(null); setErr(null) }} loading={loading} err={err}>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>Réf. {editTarget.numero ?? '—'}</p>
          {contractFields}
        </Modal>
      )}

      {/* Résilier contrat */}
      {resilierTarget && (
        <Modal title={`Résilier — ${resilierTarget.profile?.prenoms} ${resilierTarget.profile?.nom}`} onSubmit={resilier} onClose={() => { setResilierTarget(null); setErr(null) }} loading={loading} err={err}>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            Contrat <strong>{resilierTarget.type_contrat}</strong> ({resilierTarget.numero ?? '—'})<br />
            <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Cette action est irréversible.</span>
          </p>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motif de résiliation * <span style={{ color: '#9ca3af' }}>(min. 10 caractères)</span></label>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={4} placeholder="Expliquez le motif de la résiliation..."
              style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: motif.length < 10 ? '#dc2626' : '#16a34a', marginTop: 4 }}>{motif.length} caractères</div>
          </div>
        </Modal>
      )}

      {/* Renouveler contrat */}
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
