'use client'
import { useState } from 'react'

type Manager = { id: string; nom: string; prenoms: string; role: string }

type Props = {
  userId: string
  currentManagerId: string | null
  managers: Manager[]
}

export default function ManagerAssignSelect({ userId, currentManagerId, managers }: Props) {
  const [value, setValue] = useState(currentManagerId ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')

  async function save(newValue: string) {
    setValue(newValue)
    setStatus('saving')
    try {
      const res = await fetch(`/api/admin/users/${userId}/manager`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: newValue || null }),
      })
      setStatus(res.ok ? 'ok' : 'err')
    } catch {
      setStatus('err')
    }
    setTimeout(() => setStatus('idle'), 2000)
  }

  const borderColor = status === 'ok' ? '#16a34a' : status === 'err' ? '#dc2626' : 'var(--abed-border)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={value}
        onChange={e => save(e.target.value)}
        disabled={status === 'saving'}
        style={{
          fontSize: 12, padding: '4px 8px',
          border: `1px solid ${borderColor}`,
          borderRadius: 6, background: '#fff',
          maxWidth: 180, cursor: 'pointer',
          opacity: status === 'saving' ? .6 : 1,
        }}
      >
        <option value="">— Aucun —</option>
        {managers.map(m => (
          <option key={m.id} value={m.id}>
            {m.prenoms} {m.nom}
          </option>
        ))}
      </select>
      {status === 'saving' && <span style={{ fontSize: 11, color: '#6b7280' }}>…</span>}
      {status === 'ok' && <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>}
      {status === 'err' && <span style={{ fontSize: 13, color: '#dc2626' }}>✗</span>}
    </div>
  )
}
