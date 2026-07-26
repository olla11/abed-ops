'use client'
import { useState } from 'react'

const ROLES = [
  { key: 'missionnaire', label: 'Missionnaire' },
  { key: 'prestataire', label: 'Prestataire' },
  { key: 'manager', label: 'Manager' },
  { key: 'aaf', label: 'AAF' },
  { key: 'caf', label: 'CAF' },
  { key: 'de', label: 'Directeur Exécutif' },
  { key: 'dp', label: 'Directeur des Programmes' },
  { key: 'rh', label: 'RH' },
  { key: 'administrateur', label: 'Administrateur (CA)' },
  { key: 'admin', label: 'Admin système' },
  { key: 'superadmin', label: 'Superadmin ⚠️' },
]

export default function RoleEditSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [value, setValue] = useState(currentRole)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [err, setErr] = useState('')

  async function save(newValue: string) {
    const previous = value
    setValue(newValue)
    setStatus('saving')
    setErr('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newValue }),
      })
      if (res.ok) {
        setStatus('ok')
      } else {
        const j = await res.json().catch(() => ({}))
        setErr(j.error ?? 'Erreur')
        setValue(previous)
        setStatus('err')
      }
    } catch {
      setValue(previous)
      setStatus('err')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }

  const borderColor = status === 'ok' ? '#16a34a' : status === 'err' ? '#dc2626' : 'var(--abed-border)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          value={value}
          onChange={e => save(e.target.value)}
          disabled={status === 'saving'}
          style={{
            fontSize: 12, padding: '4px 8px',
            border: `1px solid ${borderColor}`,
            borderRadius: 6, background: '#fff',
            width: '100%', maxWidth: 190, cursor: 'pointer',
            opacity: status === 'saving' ? .6 : 1,
          }}
        >
          {ROLES.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        {status === 'saving' && <span style={{ fontSize: 11, color: '#6b7280' }}>…</span>}
        {status === 'ok' && <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>}
        {status === 'err' && <span style={{ fontSize: 13, color: '#dc2626' }}>✗</span>}
      </div>
      {status === 'err' && err && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3, maxWidth: 190 }}>{err}</div>
      )}
    </div>
  )
}
