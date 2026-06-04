'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MissionActions({ missionId }: { missionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function signer() {
    setLoading(true); setMsg('')
    const res = await fetch(`/api/missions/${missionId}/signer`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setMsg(`✓ Signé — Réf. ${data.reference}`)
      router.refresh()
    } else {
      setMsg(`Erreur : ${data.error}`)
    }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--abed-green)' }}>
      <h3 style={{ marginBottom: 12, fontSize: 15 }}>Actions (CAF / DE / Administrateur)</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 14 }}>
        En signant, vous attribuez une référence officielle et rendez le PDF disponible au missionnaire.
      </p>
      <button className="btn" onClick={signer} disabled={loading}>
        {loading ? 'Signature en cours…' : 'Signer l\'Ordre de Mission'}
      </button>
      {msg && <p style={{ marginTop: 12, fontSize: 13 }}>{msg}</p>}
    </div>
  )
}
