'use client'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

type P = {
  id: string; nom: string; prenoms: string; role: string; type_emploi: string | null
  direction: string | null; fonction: string | null; email: string | null
  telephone: string | null; ifu: string | null; matricule: string | null
  date_naissance: string | null; nationalite: string | null; adresse: string | null
  manager_id: string | null; avatar_url: string | null
}
type Manager = { id: string; nom: string; prenoms: string }

const TYPE_LABELS: Record<string, string> = {
  benevole: 'Bénévole', stagiaire_n1: 'Stagiaire N1', stagiaire_n2: 'Stagiaire N2',
  cdd: 'CDD', cdi: 'CDI', prestataire_direct: 'Prestataire direct',
  prestataire_credit: 'Prestataire crédit',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', rh: 'RH', caf: 'CAF', de: 'DE', aaf: 'AAF',
  administrateur: 'Administrateur', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

export default function PersonnelClient({ personnel, managers }: { personnel: P[]; managers: Manager[] }) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState<P | null>(null)
  const [form, setForm] = useState<Partial<P>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const filtered = personnel.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${p.prenoms} ${p.nom} ${p.email ?? ''} ${p.fonction ?? ''}`.toLowerCase().includes(q)
    const matchRole = !filterRole || p.role === filterRole || p.type_emploi === filterRole
    return matchSearch && matchRole
  })

  function openEdit(p: P) {
    setEditTarget(p)
    setForm({ ...p })
    setMsg(null)
  }

  async function saveEdit() {
    if (!editTarget) return
    setSaving(true)
    setMsg(null)
    const res = await fetch('/api/rh/update-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editTarget.id, ...form }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('Enregistré !')
      setTimeout(() => { setEditTarget(null); location.reload() }, 800)
    } else {
      const d = await res.json()
      setMsg(d.error ?? 'Erreur')
    }
  }

  function exportCSV() {
    window.open('/api/rh/export-personnel', '_blank')
  }

  const roles = Array.from(new Set(personnel.map(p => p.role))).sort()

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Personnel ({filtered.length})</h2>
        <button onClick={exportCSV} style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: 'var(--abed-green)', color: 'white', border: 'none',
        }}>
          Exporter CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Rechercher par nom, email, fonction..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ ...inputStyle, maxWidth: 340 }}
        />
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="">Tous les rôles</option>
          {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          {['cdd', 'cdi', 'benevole', 'stagiaire_n1', 'stagiaire_n2', 'prestataire_direct', 'prestataire_credit'].map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Nom', 'Rôle / Type', 'Fonction', 'Direction', 'Email', 'Téléphone', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginate(filtered, page).map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{p.prenoms} {p.nom}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}>
                  <span style={{ display: 'block', color: '#374151' }}>{ROLE_LABELS[p.role] ?? p.role}</span>
                  {p.type_emploi && <span style={{ color: '#6b7280' }}>{TYPE_LABELS[p.type_emploi] ?? p.type_emploi}</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.fonction ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.direction ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.email ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{p.telephone ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button onClick={() => openEdit(p)} style={{
                    padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6,
                    background: 'white', border: '1px solid var(--abed-border)', color: '#374151',
                  }}>Modifier</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun résultat</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} total={filtered.length} onChange={p => { setPage(p) }} />
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 460, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 20, fontSize: 16 }}>Modifier — {editTarget.prenoms} {editTarget.nom}</h3>
            {[
              ['fonction', 'Fonction'],
              ['direction', 'Direction / Service'],
              ['telephone', 'Téléphone'],
              ['matricule', 'Matricule'],
              ['adresse', 'Adresse'],
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={(form as any)[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Responsable technique</label>
              <select value={form.manager_id ?? ''} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value || null }))} style={inputStyle}>
                <option value="">— Aucun —</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.prenoms} {m.nom}</option>)}
              </select>
            </div>
            {msg && <div style={{ fontSize: 13, color: msg === 'Enregistré !' ? 'var(--abed-green)' : '#c0392b', marginBottom: 12 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditTarget(null)} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={saveEdit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: saving ? .6 : 1 }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
