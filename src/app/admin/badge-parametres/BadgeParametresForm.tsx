'use client'
import { useState } from 'react'

export default function BadgeParametresForm({ latitude, longitude, rayonMetres }: {
  latitude: string; longitude: string; rayonMetres: string
}) {
  const [lat, setLat] = useState(latitude)
  const [lng, setLng] = useState(longitude)
  const [rayon, setRayon] = useState(rayonMetres)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function enregistrer() {
    setLoading(true); setMsg(null)
    const res = await fetch('/api/admin/badge-parametres', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng, rayon_metres: rayon }),
    })
    const json = await res.json()
    setLoading(false)
    setMsg(res.ok ? { type: 'ok', text: 'Enregistré.' } : { type: 'err', text: json.error ?? 'Erreur' })
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Latitude</span>
          <input value={lat} onChange={e => setLat(e.target.value)} placeholder="9.364514"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, boxSizing: 'border-box' }} />
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Longitude</span>
          <input value={lng} onChange={e => setLng(e.target.value)} placeholder="2.630348"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, boxSizing: 'border-box' }} />
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Rayon autorisé (mètres)</span>
          <input type="number" value={rayon} onChange={e => setRayon(e.target.value)} min={5} max={1000}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, boxSizing: 'border-box' }} />
        </label>
        <p style={{ fontSize: 11.5, color: 'var(--abed-muted)' }}>
          Astuce : sur Google Maps, clic droit sur l&apos;emplacement exact du bureau pour copier ses coordonnées.
        </p>
        {msg && (
          <div style={{ fontSize: 12.5, padding: '8px 12px', borderRadius: 8, background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
            {msg.text}
          </div>
        )}
        <button className="btn" onClick={enregistrer} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
