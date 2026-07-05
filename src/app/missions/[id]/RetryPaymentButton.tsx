'use client'
import { useState } from 'react'

export default function RetryPaymentButton({ missionId, prelevement }: { missionId: string; prelevement: number | null }) {
  const [loading, setLoading] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function retry() {
    setLoading(true); setErr(''); setPaymentUrl(null)
    const res = await fetch(`/api/missions/${missionId}/retry-payment`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setErr(data.error ?? 'Erreur')
    else setPaymentUrl(data.paymentUrl)
  }

  if (paymentUrl) {
    return (
      <a className="btn" href={paymentUrl} target="_blank" rel="noopener noreferrer"
        style={{ background: '#c0392b' }}>
        💳 Payer le prélèvement ({Number(prelevement).toLocaleString('fr-FR')} F CFA)
      </a>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button className="btn" onClick={retry} disabled={loading}
        style={{ background: '#c0392b' }}>
        {loading ? 'Génération…' : `💳 Nouveau lien de paiement (${Number(prelevement).toLocaleString('fr-FR')} F)`}
      </button>
      {err && <span style={{ fontSize: 12, color: '#c0392b' }}>{err}</span>}
    </div>
  )
}
