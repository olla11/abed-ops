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
  const [status, setStatus] = useState('')

  async function save() {
    setStatus('…')
    try {
      const res = await fetch(`/api/admin/users/${userId}/manager`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: value || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('✓ Enregistré')
      } else {
        setStatus('✗ ' + (data.error ?? 'Erreur'))
      }
    } catch {
      setStatus('✗ Réseau')
    }
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--abed-border)', borderRadius: 6, background: '#fff', maxWidth: 160 }}
      >
        <option value="">— Aucun —</option>
        {managers.map(m => (
          <option key={m.id} value={m.id}>
            {m.prenoms} {m.nom} ({m.role})
          </option>
        ))}
      </select>
      <button
        onClick={save}
        style={{ fontSize: 12, padding: '4px 10px', background: 'var(--abed-green)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        {status || 'OK'}
      </button>
    </div>
  )
}
