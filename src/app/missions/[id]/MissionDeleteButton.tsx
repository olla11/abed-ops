'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MissionDeleteButton({ missionId }: { missionId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function del() {
    setLoading(true); setErr('')
    const res = await fetch(`/api/missions/${missionId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.push('/dashboard')
    else { setErr(data.error ?? 'Erreur inconnue'); setConfirm(false) }
  }

  if (!confirm) {
    return (
      <button className="btn" style={{ background: 'var(--abed-danger)', borderColor: 'var(--abed-danger)' }}
        onClick={() => setConfirm(true)}>
        Supprimer cet OM
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--abed-danger)' }}>Supprimer definitivement cet ordre de mission ?</span>
      <button className="btn" style={{ background: 'var(--abed-danger)', borderColor: 'var(--abed-danger)' }}
        disabled={loading} onClick={del}>{loading ? 'Suppression...' : 'Confirmer'}</button>
      <button className="btn secondary" onClick={() => setConfirm(false)}>Annuler</button>
      {err && <span style={{ fontSize: 13, color: 'var(--abed-danger)' }}>{err}</span>}
    </div>
  )
}