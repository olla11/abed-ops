'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserDeleteButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function del() {
    setLoading(true); setErr('')
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.refresh()
    else { setErr(data.error ?? 'Erreur inconnue'); setConfirm(false) }
  }

  if (err) return <span style={{ fontSize: 12, color: 'var(--abed-danger)' }}>{err}</span>

  if (!confirm) {
    return (
      <button style={{ fontSize: 12, color: 'var(--abed-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        onClick={() => setConfirm(true)} title={`Supprimer ${name}`}>
        Supprimer
      </button>
    )
  }

  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button className="btn" style={{ fontSize: 12, padding: '2px 8px', background: 'var(--abed-danger)', borderColor: 'var(--abed-danger)' }}
        disabled={loading} onClick={del}>{loading ? '...' : 'Confirmer'}</button>
      <button className="btn secondary" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setConfirm(false)}>Annuler</button>
    </span>
  )
}