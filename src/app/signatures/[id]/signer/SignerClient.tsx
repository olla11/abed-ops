'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { attendrePoliceSignature } from '@/lib/signature-font'

type Props = {
  demandeId: string
  titre: string
  fichierUrl: string | null
  userName: string
  contratId?: string | null
  zoneImposee?: { x: number; y: number; page: number } | null
  signatureEnregistree?: string | null
}

type SignMode = 'saisir' | 'dessiner' | 'importer' | 'enregistree'
type StampOptions = { bracket: boolean; header: boolean; date: boolean; hash: boolean }
const DEFAULT_STAMP_OPTIONS: StampOptions = { bracket: true, header: true, date: true, hash: true }

/**
 * Recadre un canvas transparent sur le contenu réellement dessiné (retire les
 * marges vides autour du trait), pour que l'image importée dans le tampon ne
 * laisse pas un grand vide disproportionné.
 */
function trimTransparentCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = 0, maxY = 0
  let found = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 10) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!found) return canvas.toDataURL('image/png')
  const pad = 6
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad)
  const w = maxX - minX + 1, h = maxY - minY + 1
  const trimmed = document.createElement('canvas')
  trimmed.width = w; trimmed.height = h
  trimmed.getContext('2d')!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h)
  return trimmed.toDataURL('image/png')
}

/** Pavé de dessin tactile/souris — trait noir sur fond transparent. */
function SignatureDrawPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
  }, [])

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const p = 'touches' in e ? e.touches[0] : e
    return { x: p.clientX - rect.left, y: p.clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawingRef.current = true
    lastRef.current = pos(e)
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return
    e.preventDefault()
    const p = pos(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
    hasDrawnRef.current = true
  }
  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (hasDrawnRef.current && canvasRef.current) onChange(trimTransparentCanvas(canvasRef.current))
  }
  function effacer() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: '100%', height: 160, background: 'repeating-conic-gradient(#f3f4f6 0% 25%, white 0% 50%) 50% / 16px 16px', border: '1px dashed #d1d5db', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }}
      />
      <button type="button" onClick={effacer} style={{ marginTop: 6, fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#6b7280' }}>
        Effacer
      </button>
    </div>
  )
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

function SignatureBlock({ name, date, hash, small, opts = DEFAULT_STAMP_OPTIONS }: { name: string; date: string; hash: string; small?: boolean; opts?: StampOptions }) {
  // Layout mirrors the canvas capture: header 15.5%, name baseline 60.4%, sep 70%, date 93.3%
  // Chaque élément peut être désactivé (opts) — la ligne de base du nom se
  // resserre vers le haut/bas de l'espace disponible en conséquence, plutôt
  // que de laisser un vide à la place de l'élément retiré (même logique que
  // habillerEnTampon dans SignatureCaptureModal).
  const bh = small ? 68 : 85
  const barW = 2
  const hookLen = small ? 9 : 13
  const fontSize = small ? 18 : 24
  const headerFontSize = small ? 7.5 : 9
  const footerFontSize = small ? 7 : 8
  const cornerRadius = Math.round(bh * 0.047)
  const bracketInset = Math.round(bh * 0.165)
  const headerTop = Math.round(bh * 0.04)
  const hasFooter = opts.date || opts.hash
  const contentAreaTop = bh * (opts.header ? 0.18 : 0.08)
  const contentAreaBottom = bh * (hasFooter ? 0.66 : 0.86)
  const nameLine = Math.round((contentAreaTop + contentAreaBottom) / 2 + fontSize * 0.32)   // baseline ≈ centre + demi-hauteur de fonte
  const sepLine   = Math.round(bh * 0.70)   // resserré vers le nom (presque collé, sans couper les descendantes)
  const dateBottom = Math.round(bh * 0.97)
  const textLeft = opts.bracket ? hookLen + 8 : 6
  const hashTexte = `${hash.slice(0, 12)}...`

  // Largeur dynamique : mesure le texte réel (comme la capture canvas) pour
  // que le tampon et sa ligne séparatrice épousent la longueur du nom, au
  // lieu d'un rectangle fixe qui débordait toujours pour un nom court. Plafonnée
  // (voir largeurMax) : un nom de signataire très long ne doit jamais pouvoir
  // forcer ce bloc — posé dans un panneau à largeur limitée — à dépasser
  // l'espace disponible et pousser le reste de la page hors champ ; le nom
  // s'affiche alors tronqué (…) plutôt que de casser la mise en page.
  const largeurMax = small ? 260 : 340
  let bw = small ? 190 : 240
  if (typeof document !== 'undefined') {
    const mesure = document.createElement('canvas').getContext('2d')
    if (mesure) {
      mesure.font = `bold ${headerFontSize}px Arial, sans-serif`
      const headerW = opts.header ? mesure.measureText('MYABED SIGNED BY:').width : 0
      mesure.font = `${fontSize}px BrittanySignature`
      const nameW = mesure.measureText(name).width
      mesure.font = `${footerFontSize}px Arial, sans-serif`
      const dateW = opts.date ? mesure.measureText(date).width : 0
      const hashW = opts.hash ? mesure.measureText(hashTexte).width : 0
      const footerW = opts.date && opts.hash ? dateW + 8 + hashW : Math.max(dateW, hashW)
      const contentW = Math.max(headerW, nameW, footerW)
      bw = Math.min(largeurMax, Math.max(small ? 120 : 150, Math.ceil(textLeft + contentW + 6)))
    }
  }
  return (
    <div style={{ position: 'relative', width: bw, height: bh, userSelect: 'none', overflow: 'visible' }}>
      {/* Bracket — resserré vers le centre, coins arrondis */}
      {opts.bracket && (
        <svg width={hookLen + 4} height={bh} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <path d={bracketPath(hookLen, bracketInset, bh - bracketInset, cornerRadius)} stroke={BRACKET_COLOR} strokeWidth={barW} fill="none" strokeLinecap="round" />
        </svg>
      )}
      {/* Header */}
      {opts.header && (
        <div style={{ position: 'absolute', top: headerTop, left: textLeft, right: 4, fontSize: small ? 7.5 : 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', lineHeight: 1 }}>
          MyABED signed by:
        </div>
      )}
      {/* Name — baseline pinned to nameLine ; débordement vertical visible (les
          fioritures de la police Brittany dépassent parfois vers le haut),
          mais horizontal tronqué (…) — la largeur du bloc est plafonnée
          (largeurMax) et un nom trop long pour y tenir doit se couper
          proprement plutôt que déborder par-dessus le reste de la page. */}
      <div style={{ position: 'absolute', left: textLeft, right: 4, top: nameLine - fontSize - 4, overflowX: 'hidden', overflowY: 'visible', lineHeight: 1 }}>
        <span style={{ fontFamily: '"BrittanySignature", cursive', fontSize, color: '#000', letterSpacing: '0.02em', fontWeight: 400, whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%', overflowX: 'hidden', overflowY: 'visible', textOverflow: 'ellipsis', verticalAlign: 'top' }}>
          {name}
        </span>
      </div>
      {/* Séparateur + footer — seulement si date et/ou hash affichés */}
      {hasFooter && (
        <>
          <div style={{ position: 'absolute', top: sepLine, left: textLeft, right: 4, borderTop: '1px solid #d1d5db' }} />
          {/* le hash suit directement la date au lieu d'être plaqué à droite du
              bloc, ce qui laissait un grand vide pour un nom court. */}
          <div style={{ position: 'absolute', top: sepLine + 4, bottom: bh - dateBottom, left: textLeft, right: 4, fontSize: small ? 7 : 8, color: '#6b7280', display: 'flex', gap: 8, fontFamily: 'Arial, sans-serif', alignItems: 'center' }}>
            {opts.date && <span>{date}</span>}
            {opts.hash && <span style={{ color: '#9ca3af' }}>{hash.slice(0, 12)}...</span>}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Renders a single PDF page to a <canvas> via pdfjs-dist.
 * Click/drag coordinates are relative to the canvas element only —
 * no browser toolbar or scroll offset involved, so they map 1:1 to PDF page space.
 */
const SIG_SCALE_MIN = 0.5
const SIG_SCALE_MAX = 2.5

function PdfCanvasViewer({
  docUrl,
  pageNumber,
  placingMode,
  sigPos,
  onPlace,
  onDragEnd,
  sigBlock,
  sigScale,
  onScaleChange,
  locked,
  zoneRect,
  onConfirmZone,
}: {
  docUrl: string
  pageNumber: number
  placingMode: boolean
  sigPos: { x: number; y: number } | null
  onPlace: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
  sigBlock: React.ReactNode
  sigScale: number
  onScaleChange: (scale: number) => void
  locked?: boolean
  // Repère vert affiché tant que le signataire n'a pas encore posé sa
  // signature sur une zone imposée — disparaît dès que sigPos est défini.
  zoneRect?: { x: number; y: number } | null
  onConfirmZone?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const renderTaskRef = useRef<{ cancel(): void } | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ scale: 1, centerX: 0, centerY: 0, initialDist: 1 })

  useEffect(() => {
    let cancelled = false
    setRendering(true)
    setError(null)

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

      // clientWidth peut valoir 0 si le conteneur n'a pas encore fini sa mise
      // en page — un `??` ne rattrape pas ce cas car 0 n'est pas nullish, ce
      // qui produisait un canvas de taille nulle (page "rendue" mais
      // invisible, sans aucune erreur). On attend une frame pour laisser le
      // layout se stabiliser avant de se rabattre sur une largeur par défaut.
      let containerWidth = wrapperRef.current?.clientWidth || 0
      if (containerWidth === 0) {
        await new Promise(r => requestAnimationFrame(r))
        if (cancelled) return
        containerWidth = wrapperRef.current?.clientWidth || 700
      }
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
      if (cancelled) return
      // RenderingCancelled is expected when page changes quickly
      if (err?.name !== 'RenderingCancelledException') {
        console.error('[PdfCanvasViewer] Échec du rendu PDF :', err)
        setRendering(false)
        setError('Impossible d\'afficher le document (fichier illisible ou lien expiré).')
      }
    })

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [docUrl, pageNumber, retryCount])

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

  // Redimensionnement proportionnel : la poignée au coin du tampon donne
  // l'échelle en comparant la distance courant→centre à la distance de
  // départ. Un seul facteur pour largeur et hauteur — jamais de déformation.
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const rect = blockRef.current?.getBoundingClientRect()
    if (!rect) return
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const initialDist = Math.max(1, Math.hypot(e.clientX - centerX, e.clientY - centerY))
    resizeStartRef.current = { scale: sigScale, centerX, centerY, initialDist }
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      const { scale, centerX, centerY, initialDist } = resizeStartRef.current
      const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY)
      const next = Math.max(SIG_SCALE_MIN, Math.min(SIG_SCALE_MAX, scale * (dist / initialDist)))
      onScaleChange(Math.round(next * 100) / 100)
    }
    function onUp() { setIsResizing(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isResizing])

  const displayPos = isDragging ? dragPos : sigPos

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', background: '#525659' }}>
      {/* Full-screen drag capture to prevent losing mouse events over other elements */}
      {(isDragging || isResizing) && <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: isResizing ? 'nwse-resize' : 'grabbing' }} />}

      {rendering && !error && (
        <div style={{ position: 'absolute', inset: 0, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, zIndex: 5 }}>
          Chargement de la page...
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', inset: 0, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', color: '#fca5a5', fontSize: 14, textAlign: 'center', padding: 24, zIndex: 5 }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setRetryCount(c => c + 1)}
            style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #6b7280', background: 'transparent', color: '#e5e7eb', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🔄 Réessayer
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: placingMode ? 'crosshair' : 'default', visibility: error ? 'hidden' : 'visible' }}
      />

      {/* Dim overlay when in placing mode */}
      {placingMode && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', cursor: 'crosshair', zIndex: 2 }}
          onClick={handleCanvasClick} />
      )}

      {/* Repère "signez ici" pour une zone imposée pas encore posée — un
          rectangle vert plutôt que la signature elle-même, pour ne pas
          donner l'impression qu'elle est déjà apposée avant confirmation. */}
      {zoneRect && !placingMode && (
        <div
          onClick={onConfirmZone}
          title="Cliquez pour poser votre signature ici"
          style={{
            position: 'absolute', left: `${zoneRect.x}%`, top: `${zoneRect.y}%`,
            transform: 'translate(-50%, -50%)',
            width: '18%', minWidth: 130, height: '7%', minHeight: 46,
            border: '2px dashed #16a34a', background: 'rgba(22,163,74,0.10)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10,
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', background: 'rgba(255,255,255,.9)', padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            ✍️ Signez ici
          </span>
        </div>
      )}

      {/* Draggable signature overlay — positioned as % of the canvas */}
      {displayPos && !placingMode && (
        <div
          ref={blockRef}
          onMouseDown={locked ? undefined : handleSigMouseDown}
          style={{
            position: 'absolute',
            left: `${displayPos.x}%`,
            top: `${displayPos.y}%`,
            transform: `translate(-50%, -50%) scale(${sigScale})`,
            cursor: locked ? 'default' : (isDragging ? 'grabbing' : 'grab'),
            zIndex: 10,
          }}
        >
          {sigBlock}
          {!isDragging && (
            <div
              onMouseDown={handleResizeStart}
              title="Glisser pour redimensionner"
              style={{
                position: 'absolute', right: -8, bottom: -8, width: 16, height: 16,
                borderRadius: '50%', background: 'white', border: '2px solid #2563eb',
                cursor: 'nwse-resize', zIndex: 11, boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function SignerClient({ demandeId, titre, fichierUrl, userName, contratId, zoneImposee, signatureEnregistree }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<SignMode>('saisir')
  const [drawnImage, setDrawnImage] = useState<string | null>(null)
  const [importedImage, setImportedImage] = useState<string | null>(null)
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [rasterPreview, setRasterPreview] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!fichierUrl)
  const [placingMode, setPlacingMode] = useState(false)
  // Zone imposée : on n'initialise plus sigPos avec la zone — tant que le
  // signataire n'a pas cliqué pour confirmer, seul un repère vert (zoneRect)
  // s'affiche. sigPos ne devient non-nul qu'après ce clic explicite.
  const [sigPos, setSigPos] = useState<{ x: number; y: number } | null>(null)
  const [sigScale, setSigScale] = useState(1)
  const [sigPage, setSigPage] = useState(zoneImposee?.page ?? 1)
  // Zone imposée : la page de la signature reste fixe (sigPage), mais on
  // permet de feuilleter librement le document pour le lire — la page
  // affichée (viewPage) est donc distincte de la page où signer.
  const [viewPage, setViewPage] = useState(zoneImposee?.page ?? 1)
  const renderedPage = zoneImposee ? viewPage : sigPage
  const overlaySigPos = (!zoneImposee || viewPage === sigPage) ? sigPos : null
  const overlayZoneRect = (zoneImposee && !sigPos && viewPage === sigPage)
    ? { x: zoneImposee.x, y: zoneImposee.y } : null

  function confirmerZone() {
    if (!zoneImposee) return
    setSigPos({ x: zoneImposee.x, y: zoneImposee.y })
  }
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)
  const [refused, setRefused] = useState(false)
  const [policeChargee, setPoliceChargee] = useState(false)
  const [options, setOptions] = useState<StampOptions>(DEFAULT_STAMP_OPTIONS)

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(userName + demandeId + today)

  // Lance le chargement de la police de signature dès l'ouverture de la page,
  // pour lui laisser le temps d'arriver même sur une connexion lente. Tant
  // qu'elle n'est pas confirmée prête, aucun <SignatureBlock> n'est affiché
  // — ça évite tout premier rendu avec la mauvaise police (aucune police par
  // défaut ne serait alors correctement remplacée après coup dans un canvas).
  useEffect(() => { attendrePoliceSignature().then(() => setPoliceChargee(true)) }, [])

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
    if (zoneImposee) {
      setViewPage(clamped) // simple lecture, la zone imposée ne bouge pas
      return
    }
    if (clamped !== sigPage) {
      setSigPage(clamped)
      setViewPage(clamped)
      setSigPos(null) // clear position when changing page — user must re-place
    }
  }

  // Render the signature block to a PNG via an offscreen canvas.
  // This captures the EXACT browser rendering (Brittany font included) so the
  // PDF embedding is pixel-perfect identical to what the user sees.
  async function captureSignatureImage(opts: StampOptions = DEFAULT_STAMP_OPTIONS): Promise<string> {
    // 3× pour un rendu net, multiplié par le facteur choisi par l'utilisateur
    // (poignée de redimensionnement) — toutes les dimensions ci-dessous en
    // dérivent, donc l'agrandissement reste proportionnel en largeur et hauteur.
    const SCALE = 3 * sigScale
    const BH = 80 * SCALE   // 240px — hauteur fixe (même échelle de police pour tout le monde)
    const hookLen = 13 * SCALE  // 39px
    const fontSize = 24 * SCALE  // 72px
    const cornerRadius = Math.round(BH * 0.047)
    const bracketInset = Math.round(BH * 0.165)
    const bx = 2 * SCALE
    const textX = bx + (opts.bracket ? hookLen + 8 * SCALE : 6 * SCALE)
    const hashTexte = `${sigHash.slice(0, 12)}...`
    const dateHashGap = 10 * SCALE
    const hasFooter = opts.date || opts.hash

    // Laisse le temps à la police (embarquée dans le bundle) de finir de
    // se préparer, sans jamais bloquer la signature sur cette base.
    await attendrePoliceSignature()

    // Mesure d'abord le texte (avant de fixer la largeur du canvas — la
    // redimensionner efface le contexte) pour que la largeur du tampon
    // s'adapte à la longueur réelle du nom, au lieu d'un rectangle fixe
    // laissant un grand vide avant le hash pour les noms courts.
    const mesure = document.createElement('canvas').getContext('2d')!
    mesure.font = `bold ${9 * SCALE}px Arial, sans-serif`
    const headerW = opts.header ? mesure.measureText('MYABED SIGNED BY:').width : 0
    mesure.font = `${fontSize}px BrittanySignature`
    const nameW = mesure.measureText(userName).width
    mesure.font = `${8 * SCALE}px Arial, sans-serif`
    const dateW = opts.date ? mesure.measureText(today).width : 0
    const hashW = opts.hash ? mesure.measureText(hashTexte).width : 0
    const footerW = opts.date && opts.hash ? dateW + dateHashGap + hashW : Math.max(dateW, hashW)

    const contentW = Math.max(headerW, nameW, footerW)
    const BW = Math.max(150 * SCALE, Math.ceil(textX + contentW + 6 * SCALE))

    const canvas = document.createElement('canvas')
    canvas.width = BW; canvas.height = BH
    const ctx = canvas.getContext('2d')!

    // Fond transparent : un canvas est transparent par défaut, donc rien à
    // dessiner ici — le tampon s'intègre directement sur la page du document
    // au lieu d'apparaître dans un rectangle blanc.

    // Bracket (blue C-shape) — coins arrondis, resserré vers le centre
    if (opts.bracket) {
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
    }

    // --- Vertical layout (all values in px at 3× scale) ---
    // BH = 240 — chaque élément peut être désactivé (opts) : la zone dispo
    // pour le nom se resserre en conséquence (même logique que
    // habillerEnTampon dans SignatureCaptureModal) plutôt que de laisser un
    // vide à la place de l'élément retiré.
    const contentAreaTop = BH * (opts.header ? 0.18 : 0.08)
    const contentAreaBottom = BH * (hasFooter ? 0.66 : 0.86)
    const nameBaselineY = Math.round((contentAreaTop + contentAreaBottom) / 2 + fontSize * 0.32)

    // Header label
    if (opts.header) {
      ctx.fillStyle = '#374151'
      ctx.font = `bold ${9 * SCALE}px Arial, sans-serif`
      ctx.fillText('MYABED SIGNED BY:', textX, Math.round(BH * 0.155))
    }

    // Signer name in Brittany
    ctx.fillStyle = '#000000'
    ctx.font = `${fontSize}px BrittanySignature`
    ctx.fillText(userName, textX, nameBaselineY)

    if (hasFooter) {
      // Separator line — s'arrête à la largeur réelle du contenu, plus jamais
      // un trait fixe qui dépasse largement un nom court.
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1 * SCALE
      ctx.beginPath()
      ctx.moveTo(textX, Math.round(BH * 0.70))
      ctx.lineTo(BW - 4 * SCALE, Math.round(BH * 0.70))
      ctx.stroke()

      // Date and hash — le hash suit immédiatement la date (plus de décalage
      // fixe qui laissait un vide quand la date/le nom sont courts). Décalés
      // d'autant que la ligne séparatrice pour garder le même espacement
      // ligne→date qu'avant (seul l'espace nom→ligne est resserré).
      let fx = textX
      if (opts.date) {
        ctx.fillStyle = '#6b7280'
        ctx.font = `${8 * SCALE}px Arial, sans-serif`
        ctx.fillText(today, fx, Math.round(BH * 0.855))
        fx += dateW + dateHashGap
      }
      if (opts.hash) {
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${8 * SCALE}px Arial, sans-serif`
        ctx.fillText(hashTexte, fx, Math.round(BH * 0.855))
      }
    }

    return canvas.toDataURL('image/png')
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  /**
   * Même tampon que captureSignatureImage (crochet bleu, en-tête, date, hash
   * — mêmes garanties de traçabilité) mais avec une image (dessinée,
   * importée ou enregistrée) à la place du nom saisi en police manuscrite.
   */
  async function captureImageSignatureStamp(rawImage: string, opts: StampOptions = DEFAULT_STAMP_OPTIONS): Promise<string> {
    const SCALE = 3 * sigScale
    const BH = 80 * SCALE
    const hookLen = 13 * SCALE
    const cornerRadius = Math.round(BH * 0.047)
    const bracketInset = Math.round(BH * 0.165)
    const bx = 2 * SCALE
    const textX = bx + (opts.bracket ? hookLen + 8 * SCALE : 6 * SCALE)
    const hashTexte = `${sigHash.slice(0, 12)}...`
    const dateHashGap = 10 * SCALE
    const hasFooter = opts.date || opts.hash

    const img = await loadImage(rawImage)
    const nameAreaTop = Math.round(BH * (opts.header ? 0.18 : 0.08))
    const nameAreaBottom = Math.round(BH * (hasFooter ? 0.66 : 0.86))
    const targetH = nameAreaBottom - nameAreaTop
    const maxW = 230 * SCALE
    const imgW = Math.min(maxW, targetH * (img.width / img.height))
    const imgH = imgW * (img.height / img.width)

    const mesure = document.createElement('canvas').getContext('2d')!
    mesure.font = `bold ${9 * SCALE}px Arial, sans-serif`
    const headerW = opts.header ? mesure.measureText('MYABED SIGNED BY:').width : 0
    mesure.font = `${8 * SCALE}px Arial, sans-serif`
    const dateW = opts.date ? mesure.measureText(today).width : 0
    const hashW = opts.hash ? mesure.measureText(hashTexte).width : 0
    const footerW = opts.date && opts.hash ? dateW + dateHashGap + hashW : Math.max(dateW, hashW)

    const contentW = Math.max(headerW, imgW, footerW)
    const BW = Math.max(150 * SCALE, Math.ceil(textX + contentW + 6 * SCALE))

    const canvas = document.createElement('canvas')
    canvas.width = BW; canvas.height = BH
    const ctx = canvas.getContext('2d')!

    if (opts.bracket) {
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
    }

    if (opts.header) {
      ctx.fillStyle = '#374151'
      ctx.font = `bold ${9 * SCALE}px Arial, sans-serif`
      ctx.fillText('MYABED SIGNED BY:', textX, Math.round(BH * 0.155))
    }

    ctx.drawImage(img, textX, nameAreaTop + (targetH - imgH) / 2, imgW, imgH)

    if (hasFooter) {
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1 * SCALE
      ctx.beginPath()
      ctx.moveTo(textX, Math.round(BH * 0.70))
      ctx.lineTo(BW - 4 * SCALE, Math.round(BH * 0.70))
      ctx.stroke()

      let fx = textX
      if (opts.date) {
        ctx.fillStyle = '#6b7280'
        ctx.font = `${8 * SCALE}px Arial, sans-serif`
        ctx.fillText(today, fx, Math.round(BH * 0.855))
        fx += dateW + dateHashGap
      }
      if (opts.hash) {
        ctx.fillStyle = '#9ca3af'
        ctx.font = `${8 * SCALE}px Arial, sans-serif`
        ctx.fillText(hashTexte, fx, Math.round(BH * 0.855))
      }
    }

    return canvas.toDataURL('image/png')
  }

  const rawImageForMode = mode === 'dessiner' ? drawnImage : mode === 'importer' ? importedImage : mode === 'enregistree' ? signatureEnregistree : null

  // Aperçu raster (tampon complet) recalculé à chaque changement de mode ou
  // d'image source, pour les 3 nouveaux modes — le mode "Saisir" continue à
  // s'appuyer sur <SignatureBlock> (rendu DOM, pas besoin de raster ici).
  useEffect(() => {
    if (mode === 'saisir' || !rawImageForMode) { setRasterPreview(null); return }
    let cancelled = false
    captureImageSignatureStamp(rawImageForMode, options).then(url => { if (!cancelled) setRasterPreview(url) }).catch(() => { if (!cancelled) setRasterPreview(null) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rawImageForMode, sigScale, options])

  function handleImportFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportedImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function sauvegarderSignaturePourLaProchaineFois(image: string) {
    await fetch('/api/profil/signature-enregistree', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }),
    }).catch(() => {})
  }

  async function telechargerDocument() {
    const res = await fetch(`/api/signatures/${demandeId}/document`)
    const data = await res.json().catch(() => ({}))
    if (data.url) window.open(data.url, '_blank')
  }

  async function confirmSign() {
    if (mode !== 'saisir' && !rawImageForMode) {
      setErr(mode === 'dessiner' ? 'Dessinez votre signature avant de continuer.'
        : mode === 'importer' ? 'Importez une image de votre signature avant de continuer.'
        : 'Aucune signature enregistrée — dessinez-en une puis cochez « Enregistrer ».')
      return
    }
    setLoading(true); setErr(null)
    // Capture the signature as a PNG image from the browser's own rendering
    let sig_image: string
    try {
      sig_image = mode === 'saisir' ? await captureSignatureImage(options) : await captureImageSignatureStamp(rawImageForMode!, options)
    } catch {
      setLoading(false)
      setErr('Erreur lors de la génération de la signature. Réessayez.')
      return
    }
    if (saveAsDefault && (mode === 'dessiner' || mode === 'importer') && rawImageForMode) {
      sauvegarderSignaturePourLaProchaineFois(rawImageForMode)
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

  const sigBlock = mode === 'saisir'
    ? (policeChargee ? <SignatureBlock name={userName} date={today} hash={sigHash} opts={options} /> : null)
    : (rasterPreview ? <img src={rasterPreview} alt="Signature" style={{ display: 'block', maxWidth: 260 }} /> : null)

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
            {sigBlock}
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
      {/* flex-shrink:0 sur les deux colonnes (ancienne valeur : "0 0 62%" /
          "0 0 38%") empêchait toute compression : sur une fenêtre trop
          étroite, ou quand le panneau de droite avait besoin d'un peu plus
          de place (ex: un nom de signataire long dans SignatureBlock), la
          ligne entière dépassait la largeur visible et l'overflow:hidden du
          conteneur parent effaçait silencieusement ce qui ne rentrait plus —
          sans barre de défilement pour le récupérer. Le bouton "Confirmer la
          signature", en bas du panneau de droite, pouvait alors devenir
          injoignable. Cette colonne peut désormais rétrécir (flex-shrink:1)
          jusqu'à sa largeur minimale. */}
      <div style={{ flex: '1 1 62%', minWidth: 320, background: '#525659', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', background: '#3d4043', borderBottom: '1px solid #2a2d30', fontSize: 13, fontWeight: 600, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {titre}</span>
          {fichierUrl && !placingMode && (
            <button onClick={telechargerDocument}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#e5e7eb', border: '1px solid #6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
              📥 Télécharger
            </button>
          )}
          {docUrl && !placingMode && !sigPos && !zoneImposee && (
            <button onClick={() => setPlacingMode(true)}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: 'white', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ✍️ Placer ma signature
            </button>
          )}
          {docUrl && !placingMode && !sigPos && zoneImposee && (
            <button onClick={confirmerZone}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: 'white', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ✍️ Poser ma signature ici
            </button>
          )}
          {placingMode && (
            <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              👆 Cliquez pour placer
              <button onClick={() => setPlacingMode(false)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>✕ Annuler</button>
            </span>
          )}
          {sigPos && !placingMode && zoneImposee && (
            <span style={{ fontSize: 12, color: '#93c5fd', flexShrink: 0 }}>🔒 Zone imposée par l&apos;expéditeur</span>
          )}
          {sigPos && !placingMode && !zoneImposee && (
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
              pageNumber={renderedPage}
              placingMode={placingMode}
              sigPos={overlaySigPos}
              onPlace={(x, y) => { setSigPos({ x, y }); setPlacingMode(false) }}
              onDragEnd={(x, y) => setSigPos({ x, y })}
              sigBlock={sigBlock}
              sigScale={sigScale}
              onScaleChange={setSigScale}
              locked={!!zoneImposee}
              zoneRect={overlayZoneRect}
              onConfirmZone={confirmerZone}
            />
          )}
        </div>

        {/* Page navigation bar */}
        {numPages && numPages > 1 && (
          <div style={{ padding: '8px 16px', background: '#3d4043', borderTop: '1px solid #2a2d30', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => goToPage(renderedPage - 1)}
              disabled={renderedPage <= 1}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: renderedPage <= 1 ? '#333' : '#555', color: renderedPage <= 1 ? '#666' : '#fff', cursor: renderedPage <= 1 ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              ‹ Précédent
            </button>
            <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
              Page {renderedPage} / {numPages}
            </span>
            <button
              onClick={() => goToPage(renderedPage + 1)}
              disabled={renderedPage >= numPages}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: renderedPage >= numPages ? '#333' : '#555', color: renderedPage >= numPages ? '#666' : '#fff', cursor: renderedPage >= numPages ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              Suivant ›
            </button>
          </div>
        )}
      </div>

      {/* Right: Signature panel */}
      <div style={{ flex: '1 1 38%', minWidth: 320, maxWidth: 480, padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', overflowX: 'hidden' }}>
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
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Manière de signer</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              { key: 'saisir', label: '✍️ Saisir' },
              { key: 'dessiner', label: '🖊️ Dessiner' },
              { key: 'importer', label: '🖼️ Importer' },
              { key: 'enregistree', label: '⭐ Enregistrée' },
            ] as { key: SignMode; label: string }[]).map(t => (
              <button key={t.key} type="button" onClick={() => setMode(t.key)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: mode === t.key ? '#2563eb' : 'white', color: mode === t.key ? 'white' : '#374151',
                  border: `1px solid ${mode === t.key ? '#2563eb' : '#e5e7eb'}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'dessiner' && (
            <div style={{ marginTop: 10 }}>
              <SignatureDrawPad onChange={setDrawnImage} />
            </div>
          )}

          {mode === 'importer' && (
            <div style={{ marginTop: 10 }}>
              <input type="file" accept="image/*" onChange={e => handleImportFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12.5 }} />
              <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '6px 0 0' }}>
                Une image avec fond transparent (PNG) donne le meilleur résultat.
              </p>
            </div>
          )}

          {mode === 'enregistree' && !signatureEnregistree && (
            <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 10 }}>
              Aucune signature enregistrée. Dessinez-en une ou importez-en une, puis cochez « Enregistrer pour la prochaine fois ».
            </p>
          )}

          {(mode === 'dessiner' || mode === 'importer') && rawImageForMode && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', marginTop: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={saveAsDefault} onChange={e => setSaveAsDefault(e.target.checked)} />
              Enregistrer comme signature pour la prochaine fois
            </label>
          )}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Aperçu de la signature</label>
          {mode === 'saisir'
            ? (policeChargee ? <SignatureBlock name={userName} date={today} hash={sigHash} small opts={options} /> : <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Chargement...</div>)
            : (rasterPreview ? <img src={rasterPreview} alt="Aperçu de la signature" style={{ maxWidth: 190, display: 'block' }} /> : <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun aperçu pour l&apos;instant.</div>)}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Éléments affichés sur la signature</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              { key: 'bracket', label: 'Crochet bleu' },
              { key: 'header', label: '« MyABED signed by »' },
              { key: 'date', label: 'Date' },
              { key: 'hash', label: 'Hash' },
            ] as { key: keyof StampOptions; label: string }[]).map(o => (
              <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={options[o.key]} onChange={e => setOptions(prev => ({ ...prev, [o.key]: e.target.checked }))} />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* Page indicator */}
        {docUrl && numPages && (
          <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#374151' }}>
            📄 Page <strong>{renderedPage}</strong> sur <strong>{numPages}</strong>
            {zoneImposee && renderedPage === sigPage && <span style={{ color: '#2563eb', marginLeft: 6 }}>— zone de signature ici</span>}
            {zoneImposee && renderedPage !== sigPage && <span style={{ color: '#6b7280', marginLeft: 6 }}>— signature en attente page {sigPage}</span>}
            {!zoneImposee && sigPos && <span style={{ color: '#16a34a', marginLeft: 6 }}>— signature placée ici</span>}
            {!zoneImposee && !sigPos && <span style={{ color: '#6b7280', marginLeft: 6 }}>— naviguez puis placez la signature</span>}
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
        {docUrl && !sigPos && !placingMode && !zoneImposee && (
          <div style={{ background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#92400e' }}>
            Cliquez sur <strong>« ✍️ Placer ma signature »</strong> puis cliquez l&apos;endroit voulu sur le document. Vous pourrez ensuite la déplacer.
          </div>
        )}
        {docUrl && !sigPos && !placingMode && zoneImposee && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
            🔒 <strong>Zone de signature imposée</strong> — l&apos;expéditeur a indiqué où vous devez signer (rectangle vert sur le document). Cliquez dessus, ou sur <strong>« ✍️ Poser ma signature ici »</strong>, pour l&apos;apposer.
          </div>
        )}
        {placingMode && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e40af' }}>
            Cliquez sur le document à l&apos;endroit où vous souhaitez apposer votre signature.
          </div>
        )}
        {sigPos && zoneImposee && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
            <div>🔒 <strong>Zone de signature imposée</strong> — l&apos;expéditeur a défini où vous devez signer, vous ne pouvez pas la déplacer.</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 12 }}>
              <span>↔️ Vous pouvez tout de même la redimensionner ({Math.round(sigScale * 100)}%)</span>
              {sigScale !== 1 && (
                <button onClick={() => setSigScale(1)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid #bfdbfe', color: '#1e40af', marginLeft: 8, flexShrink: 0 }}>
                  Taille normale
                </button>
              )}
            </div>
          </div>
        )}
        {sigPos && !zoneImposee && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Signature placée — glissez pour ajuster</span>
              <button onClick={() => { setSigPos(null); setPlacingMode(true) }}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid #86efac', color: '#166534', marginLeft: 8, flexShrink: 0 }}>
                Replacer
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 12 }}>
              <span>↔️ Glissez le petit cercle bleu au coin pour redimensionner ({Math.round(sigScale * 100)}%)</span>
              {sigScale !== 1 && (
                <button onClick={() => setSigScale(1)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid #86efac', color: '#166534', marginLeft: 8, flexShrink: 0 }}>
                  Taille normale
                </button>
              )}
            </div>
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
