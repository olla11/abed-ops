'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { attendrePoliceSignature } from '@/lib/signature-font'
import { BRITTANY_SIGNATURE_FONT_DATA_URI } from '@/lib/signature-font-data'

type Props = {
  demandeId: string
  titre: string
  fichierUrl: string | null
  userName: string
  contratId?: string | null
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

// Crochet aux coins arrondis, resserré vers le centre (autour du nom) plutôt
// que de courir sur toute la hauteur du bloc.
function bracketPath(hookLen: number, topY: number, bottomY: number, radius: number): string {
  const x = 2
  return `M ${x + hookLen},${topY} L ${x + radius},${topY} A ${radius},${radius} 0 0 0 ${x},${topY + radius} L ${x},${bottomY - radius} A ${radius},${radius} 0 0 0 ${x + radius},${bottomY} L ${x + hookLen},${bottomY}`
}

function SignatureBlock({ name, date, hash, small }: { name: string; date: string; hash: string; small?: boolean }) {
  // Layout mirrors the canvas capture: header 15.5%, name baseline 60.4%, sep 77.8%, date 93.3%
  const bw = small ? 190 : 240
  const bh = small ? 68 : 85
  const barW = 2
  const hookLen = small ? 9 : 13
  const fontSize = small ? 18 : 24
  const cornerRadius = Math.round(bh * 0.047)
  const bracketInset = Math.round(bh * 0.165)
  const headerTop = Math.round(bh * 0.04)
  const nameLine = Math.round(bh * 0.604)   // aligns with canvas baseline %
  const sepLine   = Math.round(bh * 0.778)
  const dateBottom = Math.round(bh * 0.97)
  return (
    <div style={{ position: 'relative', width: bw, height: bh, userSelect: 'none', background: 'white', overflow: 'visible' }}>
      <style>{`@font-face { font-family: 'BrittanySignature'; src: url('${BRITTANY_SIGNATURE_FONT_DATA_URI}') format('truetype'); font-weight: normal; font-style: normal; }`}</style>
      {/* Bracket — resserré vers le centre, coins arrondis */}
      <svg width={hookLen + 4} height={bh} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={bracketPath(hookLen, bracketInset, bh - bracketInset, cornerRadius)} stroke={BRACKET_COLOR} strokeWidth={barW} fill="none" strokeLinecap="round" />
      </svg>
      {/* Header */}
      <div style={{ position: 'absolute', top: headerTop, left: hookLen + 8, right: 4, fontSize: small ? 7.5 : 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', lineHeight: 1 }}>
        MyABED signed by:
      </div>
      {/* Name — baseline pinned to nameLine, overflow visible for tall Brittany flourishes */}
      <div style={{ position: 'absolute', left: hookLen + 8, right: 4, top: nameLine - fontSize - 4, overflow: 'visible', lineHeight: 1 }}>
        <span style={{ fontFamily: '"BrittanySignature", cursive', fontSize, color: '#000', letterSpacing: '0.02em', fontWeight: 400, whiteSpace: 'nowrap', display: 'inline-block', overflow: 'visible' }}>
          {name}
        </span>
      </div>
      {/* Separator */}
      <div style={{ position: 'absolute', top: sepLine, left: hookLen + 8, right: 4, borderTop: '1px solid #d1d5db' }} />
      {/* Footer */}
      <div style={{ position: 'absolute', top: sepLine + 4, bottom: bh - dateBottom, left: hookLen + 8, right: 4, fontSize: small ? 7 : 8, color: '#6b7280', display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', alignItems: 'center' }}>
        <span>{date}</span>
        <span style={{ color: '#9ca3af' }}>{hash.slice(0, 12)}...</span>
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

export default function SignerClient({ demandeId, titre, fichierUrl, userName, contratId }: Props) {
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
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)
  const [refused, setRefused] = useState(false)

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(userName + demandeId + today)

  // Lance le chargement de la police de signature dès l'ouverture de la page,
  // pour lui laisser le temps d'arriver même sur une connexion lente — avant
  // que l'utilisateur ne clique sur "Signer".
  useEffect(() => { attendrePoliceSignature(24 * 3) }, [])

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

  // Render the signature block to a PNG via an offscreen canvas.
  // This captures the EXACT browser rendering (Brittany font included) so the
  // PDF embedding is pixel-perfect identical to what the user sees.
  async function captureSignatureImage(): Promise<string> {
    const SCALE = 3  // render at 3× for crisp PDF embedding
    const BW = 240 * SCALE  // 720px
    const BH = 80 * SCALE   // 240px
    const hookLen = 13 * SCALE  // 39px
    const fontSize = 24 * SCALE  // 72px
    const cornerRadius = Math.round(BH * 0.047)
    const bracketInset = Math.round(BH * 0.165)

    const canvas = document.createElement('canvas')
    canvas.width = BW; canvas.height = BH
    const ctx = canvas.getContext('2d')!

    // Laisse le temps à la police (embarquée dans le bundle) de finir de
    // se préparer, sans jamais bloquer la signature sur cette base.
    await attendrePoliceSignature(fontSize)

    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, BW, BH)

    // Bracket (blue C-shape) — coins arrondis, resserré vers le centre
    const bx = 2 * SCALE
    ctx.strokeStyle = BRACKET_COLOR
    ctx.lineWidth = 2 * SCALE
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(bx + hookLen, bracketInset)
    ctx.lineTo(bx + cornerRadius, bracketInset)
    ctx.arcTo(bx, bracketInset, bx, bracketInset + cornerRadius, cornerRadius)
    ctx.lineTo(bx, BH - bracketInset - cornerRadius)
    ctx.arcTo(bx, BH - bracketInset, bx + cornerRadius, BH - bracketInset, cornerRadius)
    ctx.lineTo(bx + hookLen, BH - bracketInset)
    ctx.stroke()

    const textX = bx + hookLen + 8 * SCALE

    // --- Vertical layout (all values in px at 3× scale) ---
    // BH = 240
    // Header baseline  :  42px (15.5% — gives label room then gap before name)
    // Name baseline    : 163px (60.4% — Brittany ascenders ~72px above → top at 91px,
    //                            well below header end; descenders ~18px below → 181px)
    // Separator        : 210px (77.8% — 29px below descender bottom, clean gap)
    // Date baseline    : 252px (93.3%)

    // Header label
    ctx.fillStyle = '#374151'
    ctx.font = `bold ${9 * SCALE}px Arial, sans-serif`
    ctx.fillText('MYABED SIGNED BY:', textX, Math.round(BH * 0.155))

    // Signer name in Brittany
    ctx.fillStyle = '#000000'
    ctx.font = `${fontSize}px BrittanySignature`
    ctx.fillText(userName, textX, Math.round(BH * 0.604))

    // Separator line
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1 * SCALE
    ctx.beginPath()
    ctx.moveTo(textX, Math.round(BH * 0.778))
    ctx.lineTo(BW - 4 * SCALE, Math.round(BH * 0.778))
    ctx.stroke()

    // Date and hash
    ctx.fillStyle = '#6b7280'
    ctx.font = `${8 * SCALE}px Arial, sans-serif`
    ctx.fillText(today, textX, Math.round(BH * 0.933))
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(`${sigHash.slice(0, 12)}...`, textX + 90 * SCALE, Math.round(BH * 0.933))

    return canvas.toDataURL('image/png')
  }

  async function telechargerDocument() {
    const res = await fetch(`/api/signatures/${demandeId}/document`)
    const data = await res.json().catch(() => ({}))
    if (data.url) window.open(data.url, '_blank')
  }

  async function confirmSign() {
    setLoading(true); setErr(null)
    // Capture the signature as a PNG image from the browser's own rendering
    let sig_image: string
    try {
      sig_image = await captureSignatureImage()
    } catch {
      setLoading(false)
      setErr('Erreur lors de la génération de la signature. Réessayez.')
      return
    }
    const res = await fetch(`/api/signatures/${demandeId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sig_x: sigPos?.x ?? 50, sig_y: sigPos?.y ?? 80, sig_page: sigPage, sig_image }),
    })
    setLoading(false)
    if (res.ok) setSigned(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors de la signature') }
  }

  async function refuserSansSigner() {
    if (motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusing(true); setErr(null)
    const url = contratId ? `/api/contrats/${contratId}/refuser-signataire` : `/api/signatures/${demandeId}/refuse`
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motif }),
    })
    setRefusing(false)
    if (res.ok) setRefused(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors du refus') }
  }

  const sigBlock = <SignatureBlock name={userName} date={today} hash={sigHash} />

  if (refused) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '32px 40px', textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>↩️</div>
          <h2 style={{ color: '#991b1b', marginBottom: 8, fontSize: 20 }}>{contratId ? 'Document renvoyé au RH' : 'Signature refusée'}</h2>
          <p style={{ color: '#374151', fontSize: 14 }}>
            {contratId
              ? 'Le RH a été notifié de votre motif et pourra apporter les corrections nécessaires.'
              : "L'initiateur de la demande a été notifié de votre motif et pourra corriger le document avant de le renvoyer."}
          </p>
          <button onClick={() => router.push('/signatures')}
            style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, background: '#b91c1c', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
            ← Retour aux signatures
          </button>
        </div>
      </div>
    )
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
          {fichierUrl && (
            <button onClick={telechargerDocument}
              style={{ marginTop: 4, padding: '10px 24px', borderRadius: 8, background: 'white', color: '#166534', border: '1px solid #86efac', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
              📥 Télécharger le document signé
            </button>
          )}
          <button onClick={() => router.push('/signatures')}
            style={{ marginTop: 10, padding: '10px 24px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
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
          {fichierUrl && !placingMode && (
            <button onClick={telechargerDocument}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#e5e7eb', border: '1px solid #6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
              📥 Télécharger
            </button>
          )}
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
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: contratId && !docUrl ? '#fff' : undefined }}>
          {loadingDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
          ) : !docUrl && contratId ? (
            <iframe
              src={`/api/contrat-pdf/${contratId}`}
              title={titre}
              style={{ width: '100%', height: '100%', minHeight: '100%', border: 'none', display: 'block' }}
            />
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
        {!docUrl && !loadingDoc && contratId && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
            Lisez le contenu du contrat ci-contre. Si tout est correct, signez-le ; sinon, renvoyez-le au RH sans signer en précisant vos corrections.
          </div>
        )}
        {!docUrl && !loadingDoc && !contratId && (
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

        {showRefuseForm && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
              Motif du refus * (min. 10 caractères)
            </label>
            <textarea
              value={motif} onChange={e => setMotif(e.target.value)} rows={3}
              placeholder="Expliquez les corrections à apporter avant de signer..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          {(sigPos || (!docUrl && !loadingDoc)) && !showRefuseForm && (
            <button onClick={confirmSign} disabled={loading}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#16a34a', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signature en cours...' : '✅ Confirmer la signature'}
            </button>
          )}
          {!showRefuseForm && (
            <button onClick={() => { setShowRefuseForm(true); setErr(null) }}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'white', border: '1px solid #fecaca', color: '#b91c1c', cursor: 'pointer' }}>
              {contratId ? '↩️ Renvoyer au RH sans signer' : '✕ Refuser de signer'}
            </button>
          )}
          {showRefuseForm && (
            <button onClick={refuserSansSigner} disabled={refusing}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#b91c1c', color: 'white', border: 'none', cursor: refusing ? 'not-allowed' : 'pointer', opacity: refusing ? 0.7 : 1 }}>
              {refusing ? 'Envoi...' : (contratId ? 'Confirmer le renvoi au RH' : 'Confirmer le refus')}
            </button>
          )}
          {showRefuseForm && (
            <button onClick={() => { setShowRefuseForm(false); setMotif(''); setErr(null) }}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, background: 'white', border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer' }}>
              Annuler
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
