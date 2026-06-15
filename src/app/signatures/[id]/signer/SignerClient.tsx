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

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  useEffect(() => {
    if (!fichierUrl) return
    fetch(`/api/signatures/${demandeId}/document`)
      .then(r => r.json())
      .then(data => {
        setDocUrl(data.url ?? null)
        setLoadingDoc(false)
      })
      .catch(() => setLoadingDoc(false))
  }, [demandeId, fichierUrl])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSigPos({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
          padding: '32px 40px', textAlign: 'center', maxWidth: 480,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#166534', marginBottom: 8, fontSize: 20 }}>Document signé avec succès !</h2>
          <p style={{ color: '#374151', fontSize: 14 }}>
            Vous avez signé <strong>{titre}</strong> le {today}.
          </p>
          <button
            onClick={() => router.push('/signatures')}
            style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 8,
              background: '#16a34a', color: 'white', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ← Retour aux signatures
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left: PDF viewer */}
      <div style={{ flex: '0 0 60%', position: 'relative', background: '#f3f4f6', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#374151' }}>
          📄 {titre}
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loadingDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
              Chargement du document...
            </div>
          ) : !docUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 32 }}>
              Ce document n&apos;a pas de fichier joint
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <iframe
                src={docUrl}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title="Document à signer"
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
                {/* Signature placement */}
                {sigPos && (
                  <div style={{
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
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>✍️ Signé par {userName}</div>
                    <div style={{ fontSize: 11, color: '#4b7c5b', marginTop: 2 }}>{today}</div>
                  </div>
                )}
              </div>
              {/* Instruction below */}
              {!sigPos && (
                <div style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.65)', color: 'white',
                  padding: '8px 16px', borderRadius: 20, fontSize: 13, pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}>
                  👆 Cliquez sur le document pour placer votre signature
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Signature panel */}
      <div style={{ flex: '0 0 40%', padding: '32px 28px', background: 'white', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111827', fontWeight: 700 }}>Votre signature</h2>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Signataire</label>
          <input
            type="text"
            value={userName}
            readOnly
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
              border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151',
              boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date</label>
          <input
            type="text"
            value={today}
            readOnly
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
              border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151',
              boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        {sigPos ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#166534' }}>
              ✅ Position définie : x={sigPos.x.toFixed(1)}%, y={sigPos.y.toFixed(1)}%
            </div>
            {err && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>
                {err}
              </div>
            )}
            <button
              onClick={confirmSign}
              disabled={loading}
              style={{
                padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: '#16a34a', color: 'white', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signature en cours...' : '✅ Confirmer la signature'}
            </button>
            <button
              onClick={() => setSigPos(null)}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 13,
                background: 'white', border: '1px solid #e5e7eb', color: '#374151',
                cursor: 'pointer',
              }}
            >
              Repositionner la signature
            </button>
          </div>
        ) : (
          <div style={{ background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#92400e' }}>
            {docUrl
              ? 'Placez votre signature sur le document d\'abord'
              : 'Aucun document joint — vous pouvez signer directement'}
          </div>
        )}

        {!docUrl && !loadingDoc && !sigPos && (
          <button
            onClick={() => setSigPos({ x: 50, y: 50 })}
            style={{
              padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            ✍️ Signer maintenant
          </button>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={() => router.push('/signatures')}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13,
              background: 'white', border: '1px solid #e5e7eb', color: '#374151',
              cursor: 'pointer',
            }}
          >
            ← Retour
          </button>
        </div>
      </div>
    </div>
  )
}
