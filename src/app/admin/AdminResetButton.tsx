'use client'
import { useState } from 'react'

export default function AdminResetButton() {
  const [showModal, setShowModal] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function doReset() {
    if (confirm !== 'RESET') { alert('Tapez RESET pour confirmer.'); return }
    setLoading(true)
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'RESET' }),
    })
    const json = await res.json()
    setLoading(false)
    if (json.ok) {
      setResult({ ok: true, msg: 'Toutes les données opérationnelles ont été supprimées.' })
      setConfirm('')
    } else {
      setResult({ ok: false, msg: json.errors?.join(', ') ?? json.error ?? 'Erreur inconnue' })
    }
  }

  return (
    <>
      <button
        onClick={() => { setShowModal(true); setResult(null); setConfirm('') }}
        style={{
          background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        🗑️ Réinitialiser les données
      </button>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, margin: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#7f1d1d' }}>⚠️ Réinitialisation du système</h3>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                <strong>Action irréversible.</strong> Cette opération supprime définitivement :
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#7f1d1d', lineHeight: 1.8 }}>
                <li>Toutes les missions</li>
                <li>Tous les timesheets / soumissions</li>
                <li>Toutes les demandes de paiement</li>
                <li>Toutes les notifications</li>
                <li>Tous les rapports d'allocation</li>
              </ul>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#7f1d1d' }}>
                Les comptes utilisateurs et paramètres ne sont <strong>pas</strong> affectés.
              </p>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label">Tapez <strong>RESET</strong> pour confirmer</label>
              <input
                className="input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="RESET"
                style={{ borderColor: confirm === 'RESET' ? '#16a34a' : undefined }}
              />
            </div>

            {result && (
              <div style={{
                marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                background: result.ok ? '#dcfce7' : '#fee2e2',
                color: result.ok ? '#166534' : '#991b1b',
              }}>
                {result.ok ? '✓ ' : '✕ '}{result.msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={doReset}
                disabled={loading || confirm !== 'RESET'}
                style={{
                  background: confirm === 'RESET' ? '#7f1d1d' : '#d1d5db',
                  color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 14, fontWeight: 600,
                  cursor: confirm === 'RESET' ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? '⏳ Suppression…' : '🗑️ Confirmer la réinitialisation'}
              </button>
              <button className="btn secondary" onClick={() => setShowModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
