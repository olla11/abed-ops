'use client'
import { useState } from 'react'

type P = {
  id: string; nom: string; prenoms: string; role: string; type_emploi: string | null
  fonction: string | null
  badge_actif: boolean
  badge_jours_semaine: number[] | null
}

const JOURS = [
  { n: 1, label: 'Lun' },
  { n: 2, label: 'Mar' },
  { n: 3, label: 'Mer' },
  { n: 4, label: 'Jeu' },
  { n: 5, label: 'Ven' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', rh: 'RH', caf: 'CAF', de: 'DE', aaf: 'AAF',
  administrateur: 'Administrateur', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

function JoursSemaineSelect({ value, disabled, onChange }: {
  value: number[] | null; disabled: boolean; onChange: (v: number[] | null) => void
}) {
  const actifs = value && value.length > 0 ? new Set(value) : new Set([1, 2, 3, 4, 5])
  const personnalise = !!(value && value.length > 0)

  function toggleJour(n: number) {
    const base = personnalise ? new Set(actifs) : new Set<number>()
    if (personnalise && base.has(n)) base.delete(n)
    else base.add(n)
    const arr = [...base].sort()
    onChange(arr.length === 5 ? null : arr)
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {JOURS.map(j => {
        const checked = actifs.has(j.n)
        return (
          <button
            key={j.n}
            disabled={disabled}
            onClick={() => toggleJour(j.n)}
            title={checked ? `${j.label} — badgeage attendu` : `${j.label} — pas attendu`}
            style={{
              width: 30, height: 26, borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
              border: `1px solid ${checked ? 'var(--abed-green)' : 'var(--abed-border)'}`,
              background: checked ? 'var(--abed-green)' : 'white',
              color: checked ? 'white' : '#9ca3af',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {j.label}
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 20, border: 'none', cursor: 'pointer', position: 'relative',
        background: checked ? 'var(--abed-green)' : '#d1d5db', transition: 'background .15s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left .15s',
      }} />
    </button>
  )
}

export default function BadgeConfigurationClient({ personnel, seuilInitial }: { personnel: P[]; seuilInitial: number }) {
  const [liste, setListe] = useState(personnel)
  const [search, setSearch] = useState('')
  const [enregistrement, setEnregistrement] = useState<string | null>(null)
  const [seuil, setSeuil] = useState(seuilInitial)
  const [seuilMsg, setSeuilMsg] = useState<string | null>(null)
  const [seuilSaving, setSeuilSaving] = useState(false)

  const filtered = liste.filter(p => {
    const q = search.toLowerCase()
    return !q || `${p.prenoms} ${p.nom} ${p.fonction ?? ''}`.toLowerCase().includes(q)
  })

  async function majPersonne(id: string, fields: Partial<Pick<P, 'badge_actif' | 'badge_jours_semaine'>>) {
    setEnregistrement(id)
    setListe(l => l.map(p => p.id === id ? { ...p, ...fields } : p))
    await fetch('/api/rh/update-profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    }).catch(() => {})
    setEnregistrement(null)
  }

  async function enregistrerSeuil() {
    setSeuilSaving(true); setSeuilMsg(null)
    const res = await fetch('/api/rh/badge-seuil-rappel', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seuil }),
    })
    const json = await res.json().catch(() => ({}))
    setSeuilSaving(false)
    setSeuilMsg(res.ok ? 'Enregistré.' : (json.error ?? 'Erreur'))
  }

  return (
    <div className="page-container">
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 6 }}>Badgeage — configuration par employé</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Qui doit badger, quels jours (télétravail partiel), et au bout de combien de jours sans badgeage une alerte part.
      </p>

      <div className="card" style={{ marginBottom: 20, maxWidth: 420 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          Rappel après combien de jours consécutifs sans badgeage ?
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number" min={1} max={30} value={seuil}
            onChange={e => setSeuil(Number(e.target.value))}
            style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>jours</span>
          <button className="btn" onClick={enregistrerSeuil} disabled={seuilSaving} style={{ fontSize: 12.5, padding: '7px 16px' }}>
            {seuilSaving ? '...' : 'Enregistrer'}
          </button>
          {seuilMsg && <span style={{ fontSize: 12, color: seuilMsg === 'Enregistré.' ? 'var(--abed-green)' : '#c0392b' }}>{seuilMsg}</span>}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--abed-muted)', margin: '8px 0 0' }}>
          S'applique à tout le monde — sauf aux personnes désactivées ci-dessous, qui ne reçoivent jamais ce rappel.
        </p>
      </div>

      <input
        placeholder="Rechercher par nom, fonction..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 340, padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--abed-border)', marginBottom: 16, boxSizing: 'border-box' }}
      />

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Agent', 'Rôle', 'Badgeage requis', 'Jours attendus'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{p.prenoms} {p.nom}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{ROLE_LABELS[p.role] ?? p.role}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Toggle checked={p.badge_actif} onChange={v => majPersonne(p.id, { badge_actif: v })} />
                      {enregistrement === p.id && <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>...</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <JoursSemaineSelect
                      value={p.badge_jours_semaine}
                      disabled={!p.badge_actif}
                      onChange={v => majPersonne(p.id, { badge_jours_semaine: v })}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
