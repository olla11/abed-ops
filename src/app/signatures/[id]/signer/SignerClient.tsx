'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  demandeId: string
  titre: string
  fichierUrl: string | null
  userName: string
}

export default function SignerClient({ demandeId, titre, fichierUrl, userName }: Props) {
  const router = useRouter()
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!fichierUrl)
  const [sigPos, setSigPos] = useState<{ x: number; y: number } | null>(null)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  useEffect(() => {
    if (!fichierUrl) return
    fetch(`/api/signatures/${demandeId}/document`)
      .then(r => r.json())
      .then(data => {
        setDocUrl(data.url ?? null)
      })
      .catch(() => setDocUrl(null))
      .finally(() => setLoadingDoc(false))
  }, [demandeId, fichierUrl])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSigPos({ x, y })
  }

  async function confirmSign() {
    if (!sigPos) return
    setLoading(true)
    setErr(null)
    const res = await fetch(`/api/signatures/${demandeId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sig_x: sigPos.x, sig_y: sigPos.y, sig_page: 1 }),
    })
    setLoading(false)
    if (res.ok) {
      setSigned(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setErr(data.error ?? 'Erreur lors de la signature')
    }
  }

  if (signed) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
          padding: '40px 32px',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#16a34a', marginBottom: 8 }}>Document signé avec succès</h2>
          <p style={{ color: '#374151', marginBottom: 24 }}>
            Votre signature a bien été enregistrée pour <strong>{titre}</strong>.
          </p>
          <button
            onClick={() => router.push('/signatures')}
            style={{
              padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', background: '#16a34a', color: 'white', border: 'none',
            }}
          >
            ← Retour aux signatures
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: PDF viewer */}
      <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', background: '#f3f4f6', padding: 16, overflow: 'hidden' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#374151', fontWeight: 600 }}>{titre}</h3>
        {loadingDoc ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
            Chargement du document...
          </div>
        ) : !docUrl ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
            Ce document n&apos;a pas de fichier joint
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8, border: '1px solid #d1d5db' }}>
            <iframe
              src={docUrl}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Document PDF"
            />
            {/* Transparent overlay for click capture */}
            <div
              ref={overlayRef}
              onClick={handleOverlayClick}
              style={{
                position: 'absolute', inset: 0,
                cursor: 'crosshair',
                background: 'transparent',
              }}
            >
              {sigPos && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${sigPos.x}%`,
                    top: `${sigPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    border: '2px solid #16a34a',
                    background: 'rgba(240,253,244,0.95)',
                    padding: '8px 14px',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                    ✍️ Signé par {userName}
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{today}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {docUrl && !sigPos && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: '#6b7280' }}>
            👆 Cliquez sur le document pour placer votre signature
          </div>
        )}
      </div>

      {/* Right: Signature panel */}
      <div style={{
        flex: '0 0 40%', display: 'flex', flexDirection: 'column',
        background: 'white', padding: '28px 24px',
        borderLeft: '1px solid #e5e7eb', overflow: 'auto',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 24, marginTop: 0 }}>
          Votre signature
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
            Nom complet
          </label>
          <input
            type="text"
            value={userName}
            readOnly
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              fontSize: 14, border: '1px solid #d1d5db',
              background: '#f9fafb', color: '#374151', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
            Date de signature
          </label>
          <input
            type="text"
            value={today}
            readOnly
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              fontSize: 14, border: '1px solid #d1d5db',
              background: '#f9fafb', color: '#374151', boxSizing: 'border-box',
            }}
          />
        </div>

        {sigPos ? (
          <div>
            <div style={{
              fontSize: 12, color: '#6b7280', marginBottom: 16,
              padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
              border: '1px solid #86efac',
            }}>
              Position : x={sigPos.x.toFixed(1)}%, y={sigPos.y.toFixed(1)}%
            </div>
            {err && (
              <div style={{
                color: '#c0392b', fontSize: 13, marginBottom: 14,
                padding: '8px 12px', background: '#fee2e2', borderRadius: 8,
              }}>
                {err}
              </div>
            )}
            <button
              onClick={confirmSign}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 20px', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                background: '#16a34a', color: 'white', border: 'none',
                opacity: loading ? 0.7 : 1, marginBottom: 12,
              }}
            >
              {loading ? 'Signature en cours...' : '✅ Confirmer la signature'}
            </button>
          </div>
        ) : (
          <div style={{
            padding: '16px 14px', background: '#fef3c7', borderRadius: 8,
            border: '1px solid #fde68a', fontSize: 13, color: '#92400e', marginBottom: 16,
          }}>
            Placez votre signature sur le document d&apos;abord
          </div>
        )}

        <button
          onClick={() => router.push('/signatures')}
          style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13,
            cursor: 'pointer', background: 'white',
            border: '1px solid #d1d5db', color: '#374151',
            marginTop: 'auto',
          }}
        >
          ← Retour
        </button>
      </div>
    </div>
  )
}
