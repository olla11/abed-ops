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

const BRACKET_COLOR = '#2563eb'

function sigRotation(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return ((Math.abs(h) % 40) - 20) / 10
}

function SignatureBlock({ name, date, hash, small }: { name: string; date: string; hash: string; small?: boolean }) {
  const bw = small ? 180 : 220
  const bh = small ? 58 : 72
  const barW = 2
  const hookLen = small ? 8 : 11
  const rot = sigRotation(name)
  return (
    <div style={{ position: 'relative', width: bw, height: bh, userSelect: 'none', background: 'white' }}>
      <style>{`@font-face { font-family: 'BrittanySignature'; src: url('/fonts/BrittanySignature.ttf') format('truetype'); font-weight: normal; font-style: normal; }`}</style>
      <svg width={hookLen + 4} height={bh} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <line x1={2} y1={2} x2={2 + hookLen} y2={2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
        <line x1={2} y1={2} x2={2} y2={bh - 2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
        <line x1={2} y1={bh - 2} x2={2 + hookLen} y2={bh - 2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left: hookLen + 8, top: 0, right: 4, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 5, paddingBottom: 5 }}>
        <div style={{ fontSize: small ? 7.5 : 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>
          MyABED signed by:
        </div>
        <div style={{
          fontFamily: '"BrittanySignature", cursive',
          fontSize: small ? 28 : 38,
          color: '#000',
          lineHeight: 1,
          letterSpacing: '0.08em',
          transform: `rotate(${rot}deg)`,
          transformOrigin: 'left center',
          display: 'inline-block',
          fontWeight: 400,
        }}>
          {name}
        </div>
        <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 3, fontSize: small ? 7 : 8, color: '#6b7280', display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif' }}>
          <span>{date}</span>
          <span style={{ color: '#9ca3af' }}>{hash.slice(0, 12)}...</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders a single PDF page to a <canvas> via pdfjs-dist.
 * Click/drag coordinates are relative to the canvas element only —
 * no browser toolbar or scroll offset involved, so they map 1:1 to PDF page space.
 */
function PdfCanvasViewer({
  docUrl,
  pageNumber,
  placingMode,
  sigPos,
  onPlace,
  onDragEnd,
  sigBlock,
}: {
  docUrl: string
  pageNumber: number
  placingMode: boolean
  sigPos: { x: number; y: number } | null
  onPlace: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
  sigBlock: React.ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const renderTaskRef = useRef<{ cancel(): void } | null>(null)

  useEffect(() => {
    let cancelled = false
    setRendering(true)

    // Cancel any previous render
    renderTaskRef.current?.cancel()

    async function render() {
      const lib = await import('pdfjs-dist')
      // Webpack 5 / Next.js: new URL(..., import.meta.url) bundles the worker as a static asset
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()

      const loadingTask = lib.getDocument({ url: docUrl, withCredentials: false })
      const pdf = await loadingTask.promise
      if (cancelled) return

      const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages))
      if (cancelled) return

      const containerWidth = wrapperRef.current?.clientWidth ?? 700
      const unscaledVp = page.getViewport({ scale: 1 })
      const scale = containerWidth / unscaledVp.width
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const task = page.render({ canvasContext: ctx, viewport, canvas })
      renderTaskRef.current = task
      await task.promise
      if (!cancelled) setRendering(false)
    }

    render().catch(err => {
      // RenderingCancelled is expected when page changes quickly
      if (err?.name !== 'RenderingCancelledException' && !cancelled) setRendering(false)
    })

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [docUrl, pageNumber])

  function getPct(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (!placingMode) return
    const pos = getPct(e.clientX, e.clientY)
    if (pos) onPlace(Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10)
  }

  function handleSigMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const sigRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - sigRect.left - sigRect.width / 2,
      y: e.clientY - sigRect.top - sigRect.height / 2,
    }
    setIsDragging(true)
    setDragPos(sigPos)
  }

  useEffect(() => {
    if (!isDragging) return
    function onMove(e: MouseEvent) {
      const pos = getPct(e.clientX - dragOffsetRef.current.x, e.clientY - dragOffsetRef.current.y)
      if (pos) setDragPos({ x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 })
    }
    function onUp(e: MouseEvent) {
      setIsDragging(false)
      setDragPos(null)
      const pos = getPct(e.clientX - dragOffsetRef.current.x, e.clientY - dragOffsetRef.current.y)
      if (pos) onDragEnd(Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging])

  const displayPos = isDragging ? dragPos : sigPos

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', background: '#525659' }}>
      {/* Full-screen drag capture to prevent losing mouse events over other elements */}
      {isDragging && <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'grabbing' }} />}

      {rendering && (
        <div style={{ position: 'absolute', inset: 0, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, zIndex: 5 }}>
          Chargement de la page...
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: placingMode ? 'crosshair' : 'default' }}
      />

      {/* Dim overlay when in placing mode */}
      {placingMode && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', cursor: 'crosshair', zIndex: 2 }}
          onClick={handleCanvasClick} />
      )}

      {/* Draggable signature overlay — positioned as % of the canvas */}
      {displayPos && !placingMode && (
        <div
          onMouseDown={handleSigMouseDown}
          style={{
            position: 'absolute',
            left: `${displayPos.x}%`,
            top: `${displayPos.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 10,
          }}
        >
          {sigBlock}
        </div>
      )}
    </div>
  )
}

export default function SignerClient({ demandeId, titre, fichierUrl, userName }: Props) {
  const router = useRouter()
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!fichierUrl)
  const [placingMode, setPlacingMode] = useState(false)
  const [sigPos, setSigPos] = useState<{ x: number; y: number } | null>(null)
  const [sigPage, setSigPage] = useState(1)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(userName + demandeId + today)

  useEffect(() => {
    if (!fichierUrl) return
    fetch(`/api/signatures/${demandeId}/document`)
      .then(r => r.json())
      .then(async data => {
        const url = data.url ?? null
        setDocUrl(url)
        // Detect total page count using pdfjs
        if (url) {
          try {
            const lib = await import('pdfjs-dist')
            lib.GlobalWorkerOptions.workerSrc = new URL(
              'pdfjs-dist/build/pdf.worker.min.mjs',
              import.meta.url
            ).toString()
            const pdf = await lib.getDocument({ url, withCredentials: false }).promise
            setNumPages(pdf.numPages)
          } catch { /* non-blocking */ }
        }
        setLoadingDoc(false)
      })
      .catch(() => setLoadingDoc(false))
  }, [demandeId, fichierUrl])

  function goToPage(n: number) {
    const clamped = Math.max(1, Math.min(numPages ?? 1, n))
    if (clamped !== sigPage) {
      setSigPage(clamped)
      setSigPos(null) // clear position when changing page — user must re-place
    }
  }

  async function confirmSign() {
    setLoading(true); setErr(null)
    const res = await fetch(`/api/signatures/${demandeId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sig_x: sigPos?.x ?? 50, sig_y: sigPos?.y ?? 80, sig_page: sigPage }),
    })
    setLoading(false)
    if (res.ok) setSigned(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors de la signature') }
  }

  const sigBlock = <SignatureBlock name={userName} date={today} hash={sigHash} />

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
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left: PDF canvas viewer */}
      <div style={{ flex: '0 0 62%', background: '#525659', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', background: '#3d4043', borderBottom: '1px solid #2a2d30', fontSize: 13, fontWeight: 600, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
            <span style={{ fontSize: 12, color: '#86efac', flexShrink: 0 }}>↕ Glissez pour repositionner</span>
          )}
        </div>

        {/* Scrollable PDF canvas area */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {loadingDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
          ) : !docUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 32 }}>
              Ce document n&apos;a pas de fichier joint
            </div>
          ) : (
            <PdfCanvasViewer
              docUrl={docUrl}
              pageNumber={sigPage}
              placingMode={placingMode}
              sigPos={sigPos}
              onPlace={(x, y) => { setSigPos({ x, y }); setPlacingMode(false) }}
              onDragEnd={(x, y) => setSigPos({ x, y })}
              sigBlock={sigBlock}
            />
          )}
        </div>

        {/* Page navigation bar */}
        {numPages && numPages > 1 && (
          <div style={{ padding: '8px 16px', background: '#3d4043', borderTop: '1px solid #2a2d30', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => goToPage(sigPage - 1)}
              disabled={sigPage <= 1}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: sigPage <= 1 ? '#333' : '#555', color: sigPage <= 1 ? '#666' : '#fff', cursor: sigPage <= 1 ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              ‹ Précédent
            </button>
            <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
              Page {sigPage} / {numPages}
            </span>
            <button
              onClick={() => goToPage(sigPage + 1)}
              disabled={sigPage >= numPages}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: sigPage >= numPages ? '#333' : '#555', color: sigPage >= numPages ? '#666' : '#fff', cursor: sigPage >= numPages ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              Suivant ›
            </button>
          </div>
        )}
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

        {/* Page indicator */}
        {docUrl && numPages && (
          <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#374151' }}>
            📄 Page <strong>{sigPage}</strong> sur <strong>{numPages}</strong>
            {sigPos && <span style={{ color: '#16a34a', marginLeft: 6 }}>— signature placée ici</span>}
            {!sigPos && <span style={{ color: '#6b7280', marginLeft: 6 }}>— naviguez puis placez la signature</span>}
          </div>
        )}

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
            <span>✅ Signature placée — glissez pour ajuster</span>
            <button onClick={() => { setSigPos(null); setPlacingMode(true) }}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid #86efac', color: '#166534', marginLeft: 8, flexShrink: 0 }}>
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
  )
}
