'use client'
import { useState } from 'react'

export type Personne = { id: string; nom: string; prenoms: string }

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }

export function ResponsableSelect({ personnes, value, onChange }: { personnes: Personne[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">— Non désigné —</option>
      {personnes.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
    </select>
  )
}

export function AssociesMultiSelect({ personnes, value, onChange }: { personnes: Personne[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [filtre, setFiltre] = useState('')
  const filtered = personnes.filter(p => `${p.prenoms} ${p.nom}`.toLowerCase().includes(filtre.toLowerCase()))
  const selectionnes = personnes.filter(p => value.includes(p.id))

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }

  return (
    <div>
      {selectionnes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectionnes.map(p => (
            <span key={p.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
              color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 6px 4px 12px',
            }}>
              {p.prenoms} {p.nom}
              <button type="button" onClick={() => toggle(p.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 14, lineHeight: 1, padding: '2px 4px',
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input placeholder="Rechercher une personne à associer..." value={filtre} onChange={e => setFiltre(e.target.value)} style={inputStyle} />
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 6 }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#9ca3af', padding: '10px 12px', margin: 0 }}>Aucun résultat.</p>
        ) : filtered.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
            <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
            {p.prenoms} {p.nom}
          </label>
        ))}
      </div>
    </div>
  )
}
