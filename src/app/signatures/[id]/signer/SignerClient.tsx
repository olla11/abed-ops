'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  demandeId: string
  titre: string
  fichierUrl: string | null
  userName: string
}

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

function SignatureBlock({ name, date, hash, small }: { name: string; date: string; hash: string; small?: boolean }) {
  const bw = small ? 160 : 200
  const bh = small ? 48 : 58
  const barW = 1.5
  const hookLen = small ? 7 : 9
  return (
    <div style={{ position: 'relative', width: bw, height: bh, userSelect: 'none', background: 'transparent' }}>
      {/* C-bracket left side */}
      <svg width={bw} height={bh} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {/* top hook */}
        <line x1={2} y1={2} x2={2 + hookLen} y2={2} stroke="#111" strokeWidth={barW} />
        {/* vertical bar */}
        <line x1={2} y1={2} x2={2} y2={bh - 2} stroke="#111" strokeWidth={barW} />
        {/* bottom hook */}
        <line x1={2} y1={bh - 2} x2={2 + hookLen} y2={bh - 2} stroke="#111" strokeWidth={barW} />
      </svg>
      {/* Content */}
      <div style={{ position: 'absolute', left: 2 + hookLen + 4, top: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
        <div style={{ fontSize: small ? 7 : 8, fontWeight: 700, color: '#222', letterSpacing: 0.3, fontFamily: 'sans-serif' }}>MyABED signed by:</div>
        <div style={{
          fontFamily: '"Dancing Script", "Brush Script MT", cursive',
          fontSize: small ? 20 : 26,
          color: '#111',
          lineHeight: 1,
        }}>
          {name}
        </div>
        <div style={{ borderTop: '1px solid #ccc', paddingTop: 2, fontSize: small ? 7 : 8, color: '#666', display: 'flex', justifyContent: 'space-between', fontFamily: 'sans-serif' }}>
          <span>{date}</span>
          <span>{hash.slice(0, 10)}...</span>
        </div>
      </div>
    </div>
  )
}

export default function SignerClient({ demandeId, titre, fichierUrl, userName }: Props) {
  const router = useRouter()
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!fichierUrl)
  const [placingMode, setPlacingMode] = useState(false)
  const [sigPos, setSigPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sigBlockRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(userName + demandeId + today)

  useEffect(() => {
    if (!fichierUrl) return
    fetch(`/api/signatures/${demandeId}/document`)
      .then(r => r.json())
      .then(data => { setDocUrl(data.url ?? null); setLoadingDoc(false) })
      .catch(() => setLoadingDoc(false))
  }, [demandeId, fichierUrl])

  // Click on overlay to initially place signature
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSigPos({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
    setPlacingMode(false)
  }

  // Start dragging the signature block
  function handleSigMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const sigRect = sigBlockRef.current?.getBoundingClientRect()
    if (!sigRect) return
    setDragOffset({ x: e.clientX - sigRect.left - sigRect.width / 2, y: e.clientY - sigRect.top - sigRect.height / 2 })
    setIsDragging(true)
  }

  // Global mouse move/up for dragging
  useEffect(() => {
    if (!isDragging) return
    function onMove(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = ((e.clientX - dragOffset.x - rect.left) / rect.width) * 100
      const y = ((e.clientY - dragOffset.y - rect.top) / rect.height) * 100
      setSigPos({
        x: Math.max(5, Math.min(95, Math.round(x * 10) / 10)),
        y: Math.max(5, Math.min(95, Math.round(y * 10) / 10)),
      })
    }
    function onUp() { setIsDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging, dragOffset])

  async function confirmSign() {
    setLoading(true); setErr(null)
    const res = await fetch(`/api/signatures/${demandeId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sig_x: sigPos?.x ?? 50, sig_y: sigPos?.y ?? 80, sig_page: 1 }),
    })
    setLoading(false)
    if (res.ok) setSigned(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors de la signature') }
  }

  if (signed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '32px 40px', textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#166534', marginBottom: 8, fontSize: 20 }}>Document signé avec succès !</h2>
          <p style={{ color: '#374151', fontSize: 14 }}>Vous avez signé <strong>{titre}</strong> le {today}.</p>
          <div style={{ margin: '20px auto', display: 'inline-block' }}>
            <SignatureBlock name={userName} date={today} hash={sigHash} />
          </div>
          <button onClick={() => router.push('/signatures')}
            style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
            ← Retour aux signatures
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />

      {/* Global drag capture overlay — prevents iframe from eating mouse events */}
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />
      )}

      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* Left: PDF viewer */}
        <div style={{ flex: '0 0 62%', background: '#525659', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ padding: '10px 16px', background: '#3d4043', borderBottom: '1px solid #2a2d30', fontSize: 13, fontWeight: 600, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {titre}</span>
            {docUrl && !placingMode && !sigPos && (
              <button onClick={() => setPlacingMode(true)}
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: 'white', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                ✍️ Placer ma signature
              </button>
            )}
            {placingMode && (
              <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                👆 Cliquez pour placer
                <button onClick={() => setPlacingMode(false)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>✕ Annuler</button>
              </span>
            )}
            {sigPos && !placingMode && (
              <span style={{ fontSize: 12, color: '#86efac', flexShrink: 0 }}>
                ↕ Glissez pour repositionner
              </span>
            )}
          </div>

          {/* PDF area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {loadingDoc ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
            ) : !docUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 32 }}>
                Ce document n&apos;a pas de fichier joint
              </div>
            ) : (
              <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* PDF — always scrollable */}
                <iframe src={docUrl} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="Document à signer" />

                {/* Click overlay — ONLY in placing mode */}
                {placingMode && (
                  <div ref={overlayRef} onClick={handleOverlayClick}
                    style={{ position: 'absolute', inset: 0, cursor: 'crosshair', background: 'rgba(0,0,0,0.12)', zIndex: 10 }} />
                )}

                {/* Draggable signature block */}
                {sigPos && !placingMode && (
                  <div
                    ref={sigBlockRef}
                    onMouseDown={handleSigMouseDown}
                    style={{
                      position: 'absolute',
                      left: `${sigPos.x}%`,
                      top: `${sigPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      zIndex: 20,
                    }}
                  >
                    <SignatureBlock name={userName} date={today} hash={sigHash} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Signature panel */}
        <div style={{ flex: '0 0 38%', padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <h2 style={{ margin: 0, fontSize: 19, color: '#111827', fontWeight: 700 }}>Votre signature</h2>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Nom complet</label>
            <input value={userName} readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date de signature</label>
            <input value={today} readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Aperçu de la signature</label>
            <SignatureBlock name={userName} date={today} hash={sigHash} small />
          </div>

          {/* Instructions */}
          {!docUrl && !loadingDoc && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
              Aucun fichier joint — vous pouvez signer directement.
            </div>
          )}
          {docUrl && !sigPos && !placingMode && (
            <div style={{ background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#92400e' }}>
              Cliquez sur <strong>« ✍️ Placer ma signature »</strong> puis cliquez l&apos;endroit voulu sur le document. Vous pourrez ensuite la déplacer.
            </div>
          )}
          {placingMode && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
              Cliquez sur le document à l&apos;endroit où vous souhaitez apposer votre signature.
            </div>
          )}
          {sigPos && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Signature placée — glissez pour déplacer</span>
              <button onClick={() => { setSigPos(null); setPlacingMode(true) }}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid #86efac', color: '#166534', marginLeft: 8 }}>
                Replacer
              </button>
            </div>
          )}

          {err && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{err}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            {(sigPos || (!docUrl && !loadingDoc)) && (
              <button onClick={confirmSign} disabled={loading}
                style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#16a34a', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Signature en cours...' : '✅ Confirmer la signature'}
              </button>
            )}
            <button onClick={() => router.push('/signatures')}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, background: 'white', border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer' }}>
              ← Retour
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
