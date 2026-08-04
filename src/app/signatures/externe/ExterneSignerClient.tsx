'use client'
import { useState, useEffect, useRef } from 'react'
import { attendrePoliceSignature } from '@/lib/signature-font'

type Props = {
  token: string
  titre: string
  description: string | null
  fichierUrl: string | null
  demandeComplete: boolean
  demandeRefusee: boolean
  dejaSigne: boolean
  signeLe: string | null
  nomExterne: string | null
  email: string
  zoneImposee: { x: number; y: number; page: number } | null
}

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

const BRACKET_COLOR = '#2563eb'

// Crochet aux coins arrondis, resserré vers le centre (autour du nom) plutôt
// que de courir sur toute la hauteur du bloc.
function bracketPath(hookLen: number, topY: number, bottomY: number, radius: number): string {
  const x = 2
  return `M ${x + hookLen},${topY} L ${x + radius},${topY} A ${radius},${radius} 0 0 0 ${x},${topY + radius} L ${x},${bottomY - radius} A ${radius},${radius} 0 0 0 ${x + radius},${bottomY} L ${x + hookLen},${bottomY}`
}

function SignatureBlock({ name, date, hash, small }: { name: string; date: string; hash: string; small?: boolean }) {
  const bh = small ? 68 : 85
  const barW = 2
  const hookLen = small ? 9 : 13
  const fontSize = small ? 18 : 24
  const headerFontSize = small ? 7.5 : 9
  const footerFontSize = small ? 7 : 8
  const cornerRadius = Math.round(bh * 0.047)
  const bracketInset = Math.round(bh * 0.165)
  const headerTop = Math.round(bh * 0.04)
  const nameLine = Math.round(bh * 0.604)
  const sepLine = Math.round(bh * 0.70)   // resserré vers le nom (presque collé, sans couper les descendantes)
  const dateBottom = Math.round(bh * 0.97)
  const textLeft = hookLen + 8
  const hashTexte = `${hash.slice(0, 12)}...`

  // Largeur dynamique : mesure le texte réel (comme la capture canvas) pour
  // que le tampon et sa ligne séparatrice épousent la longueur du nom, au
  // lieu d'un rectangle fixe qui débordait toujours pour un nom court.
  let bw = small ? 190 : 240
  if (typeof document !== 'undefined') {
    const mesure = document.createElement('canvas').getContext('2d')
    if (mesure) {
      mesure.font = `bold ${headerFontSize}px Arial, sans-serif`
      const headerW = mesure.measureText('MYABED SIGNED BY:').width
      mesure.font = `${fontSize}px BrittanySignature`
      const nameW = mesure.measureText(name).width
      mesure.font = `${footerFontSize}px Arial, sans-serif`
      const dateW = mesure.measureText(date).width
      const hashW = mesure.measureText(hashTexte).width
      const contentW = Math.max(headerW, nameW, dateW + 8 + hashW)
      bw = Math.max(small ? 120 : 150, Math.ceil(textLeft + contentW + 6))
    }
  }
  return (
    <div style={{ position: 'relative', width: bw, height: bh, userSelect: 'none', overflow: 'visible' }}>
      <svg width={hookLen + 4} height={bh} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={bracketPath(hookLen, bracketInset, bh - bracketInset, cornerRadius)} stroke={BRACKET_COLOR} strokeWidth={barW} fill="none" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', top: headerTop, left: hookLen + 8, right: 4, fontSize: small ? 7.5 : 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', lineHeight: 1 }}>
        MyABED signed by:
      </div>
      <div style={{ position: 'absolute', left: hookLen + 8, right: 4, top: nameLine - fontSize - 4, overflow: 'visible', lineHeight: 1 }}>
        <span style={{ fontFamily: '"BrittanySignature", cursive', fontSize, color: '#000', letterSpacing: '0.02em', fontWeight: 400, whiteSpace: 'nowrap', display: 'inline-block', overflow: 'visible' }}>
          {name}
        </span>
      </div>
      <div style={{ position: 'absolute', top: sepLine, left: hookLen + 8, right: 4, borderTop: '1px solid #d1d5db' }} />
      {/* Footer — le hash suit directement la date au lieu d'être plaqué à
          droite du bloc, ce qui laissait un grand vide pour un nom court. */}
      <div style={{ position: 'absolute', top: sepLine + 4, bottom: bh - dateBottom, left: hookLen + 8, right: 4, fontSize: small ? 7 : 8, color: '#6b7280', display: 'flex', gap: 8, fontFamily: 'Arial, sans-serif', alignItems: 'center' }}>
        <span>{date}</span>
        <span style={{ color: '#9ca3af' }}>{hash.slice(0, 12)}...</span>
      </div>
    </div>
  )
}

const SIG_SCALE_MIN = 0.5
const SIG_SCALE_MAX = 2.5

function PdfCanvasViewer({
  docUrl, pageNumber, placingMode, sigPos, onPlace, onDragEnd, sigBlock, sigScale, onScaleChange, locked,
  zoneRect, onConfirmZone,
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
    renderTaskRef.current?.cancel()

    async function render() {
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

      const loadingTask = lib.getDocument({ url: docUrl, withCredentials: false })
      const pdf = await loadingTask.promise
      if (cancelled) return

      const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages))
      if (cancelled) return

      // clientWidth peut valoir 0 si le conteneur n'a pas encore fini sa mise
      // en page (ex. layout flex pas encore stabilisé) — un `??` ne rattrape
      // pas ce cas car 0 n'est pas nullish, ce qui produisait un canvas de
      // taille nulle (page "rendue" mais invisible, sans aucune erreur).
      // On attend une frame pour laisser le layout se stabiliser avant de
      // se rabattre sur une largeur par défaut.
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
      if (err?.name !== 'RenderingCancelledException') {
        console.error('[PdfCanvasViewer] Échec du rendu PDF :', err)
        setRendering(false)
        setError('Impossible d\'afficher le document (fichier illisible ou lien expiré).')
      }
    })

    return () => { cancelled = true; renderTaskRef.current?.cancel() }
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
    e.preventDefault(); e.stopPropagation()
    const sigRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffsetRef.current = { x: e.clientX - sigRect.left - sigRect.width / 2, y: e.clientY - sigRect.top - sigRect.height / 2 }
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
      setIsDragging(false); setDragPos(null)
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
      <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ display: 'block', width: '100%', height: 'auto', cursor: placingMode ? 'crosshair' : 'default', visibility: error ? 'hidden' : 'visible' }} />
      {placingMode && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', cursor: 'crosshair', zIndex: 2 }} onClick={handleCanvasClick} />
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
      {displayPos && !placingMode && (
        <div ref={blockRef} onMouseDown={locked ? undefined : handleSigMouseDown}
          style={{ position: 'absolute', left: `${displayPos.x}%`, top: `${displayPos.y}%`, transform: `translate(-50%, -50%) scale(${sigScale})`, cursor: locked ? 'default' : (isDragging ? 'grabbing' : 'grab'), zIndex: 10 }}>
          {sigBlock}
          {!isDragging && (
            <div
              onMouseDown={handleResizeStart}
              title="Glisser pour redimensionner"
              style={{
                position: 'absolute', right: -8, bottom: -8, width: 16, height: 16,
                borderRadius: '50%', background: 'white', border: '2px solid #2563eb',
                cursor: isResizing ? 'nwse-resize' : 'nwse-resize', zIndex: 11, boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function ExterneSignerClient({
  token, titre, description, fichierUrl, demandeComplete, demandeRefusee, dejaSigne, signeLe, nomExterne: initialNomExterne, email, zoneImposee,
}: Props) {
  const [nomExterne, setNomExterne] = useState(initialNomExterne)
  const [prenoms, setPrenoms] = useState('')
  const [nom, setNom] = useState('')
  const [savingNom, setSavingNom] = useState(false)
  const [nomErr, setNomErr] = useState<string | null>(null)

  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(!!fichierUrl)
  const [docRetryCount, setDocRetryCount] = useState(0)
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
  const [signed, setSigned] = useState(dejaSigne)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)
  const [refused, setRefused] = useState(false)
  const [policeChargee, setPoliceChargee] = useState(false)

  const today = signeLe
    ? new Date(signeLe).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash((nomExterne ?? email) + token + today)

  // Lance le chargement de la police de signature dès l'ouverture de la page.
  // Tant qu'elle n'est pas confirmée prête, aucun <SignatureBlock> n'est
  // affiché — ça évite tout premier rendu avec la mauvaise police.
  useEffect(() => { attendrePoliceSignature().then(() => setPoliceChargee(true)) }, [])

  useEffect(() => {
    if (!fichierUrl || !nomExterne) return
    setLoadingDoc(true); setDocError(null)
    fetch(`/api/signatures/externe/document?t=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(async data => {
        if (data.error) {
          console.error('[ExterneSignerClient] Erreur récupération document :', data.error)
          setDocError('Le document n\'a pas pu être récupéré. Réessayez ou contactez l\'expéditeur.')
          setLoadingDoc(false)
          return
        }
        const url = data.url ?? null
        setDocUrl(url)
        if (url) {
          try {
            const lib = await import('pdfjs-dist')
            lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
            const pdf = await lib.getDocument({ url, withCredentials: false }).promise
            setNumPages(pdf.numPages)
          } catch (e) { console.error('[ExterneSignerClient] Échec lecture PDF (numPages) :', e) }
        }
        setLoadingDoc(false)
      })
      .catch(e => {
        console.error('[ExterneSignerClient] Erreur réseau document :', e)
        setDocError('Le document n\'a pas pu être récupéré (erreur réseau). Réessayez.')
        setLoadingDoc(false)
      })
  }, [token, fichierUrl, nomExterne, docRetryCount])

  function goToPage(n: number) {
    const clamped = Math.max(1, Math.min(numPages ?? 1, n))
    if (zoneImposee) {
      setViewPage(clamped) // simple lecture, la zone imposée ne bouge pas
      return
    }
    if (clamped !== sigPage) { setSigPage(clamped); setViewPage(clamped); setSigPos(null) }
  }

  async function captureSignatureImage(): Promise<string> {
    // 3× pour un rendu net, multiplié par le facteur choisi par l'utilisateur
    // (poignée de redimensionnement) — toutes les dimensions ci-dessous en
    // dérivent, donc l'agrandissement reste proportionnel en largeur et hauteur.
    const SCALE = 3 * sigScale
    const BH = 80 * SCALE   // hauteur fixe (même échelle de police pour tout le monde)
    const hookLen = 13 * SCALE, fontSize = 24 * SCALE
    const cornerRadius = Math.round(BH * 0.047)
    const bracketInset = Math.round(BH * 0.165)
    const bx = 2 * SCALE
    const textX = bx + hookLen + 8 * SCALE
    const nomSignataire = nomExterne ?? ''
    const hashTexte = `${sigHash.slice(0, 12)}...`
    const dateHashGap = 10 * SCALE

    // Laisse le temps à la police (embarquée dans le bundle) de finir de
    // se préparer, sans jamais bloquer la signature sur cette base.
    await attendrePoliceSignature()

    // Mesure d'abord le texte (avant de fixer la largeur du canvas — la
    // redimensionner efface le contexte) pour que la largeur du tampon
    // s'adapte à la longueur réelle du nom, au lieu d'un rectangle fixe
    // laissant un grand vide avant le hash pour les noms courts.
    const mesure = document.createElement('canvas').getContext('2d')!
    mesure.font = `bold ${9 * SCALE}px Arial, sans-serif`
    const headerW = mesure.measureText('MYABED SIGNED BY:').width
    mesure.font = `${fontSize}px BrittanySignature`
    const nameW = mesure.measureText(nomSignataire).width
    mesure.font = `${8 * SCALE}px Arial, sans-serif`
    const dateW = mesure.measureText(today).width
    const hashW = mesure.measureText(hashTexte).width

    const contentW = Math.max(headerW, nameW, dateW + dateHashGap + hashW)
    const BW = Math.max(150 * SCALE, Math.ceil(textX + contentW + 6 * SCALE))

    const canvas = document.createElement('canvas')
    canvas.width = BW; canvas.height = BH
    const ctx = canvas.getContext('2d')!

    // Fond transparent : un canvas est transparent par défaut, donc rien à
    // dessiner ici — le tampon s'intègre directement sur la page du document
    // au lieu d'apparaître dans un rectangle blanc.

    // Bracket (blue C-shape) — coins arrondis, resserré vers le centre
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

    ctx.fillStyle = '#374151'
    ctx.font = `bold ${9 * SCALE}px Arial, sans-serif`
    ctx.fillText('MYABED SIGNED BY:', textX, Math.round(BH * 0.155))

    ctx.fillStyle = '#000000'
    ctx.font = `${fontSize}px BrittanySignature`
    ctx.fillText(nomSignataire, textX, Math.round(BH * 0.604))

    // Separator line — s'arrête à la largeur réelle du contenu, resserrée
    // vers le nom (presque collée aux descendantes, sans les couper).
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1 * SCALE
    ctx.beginPath()
    ctx.moveTo(textX, Math.round(BH * 0.70))
    ctx.lineTo(BW - 4 * SCALE, Math.round(BH * 0.70))
    ctx.stroke()

    // Date and hash — le hash suit immédiatement la date. Décalés d'autant
    // que la ligne pour garder le même espacement ligne→date qu'avant.
    ctx.fillStyle = '#6b7280'
    ctx.font = `${8 * SCALE}px Arial, sans-serif`
    ctx.fillText(today, textX, Math.round(BH * 0.855))
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(hashTexte, textX + dateW + dateHashGap, Math.round(BH * 0.855))

    return canvas.toDataURL('image/png')
  }

  async function telechargerDocument() {
    const res = await fetch(`/api/signatures/externe/document?t=${encodeURIComponent(token)}`)
    const data = await res.json().catch(() => ({}))
    if (data.url) window.open(data.url, '_blank')
  }

  async function submitNom() {
    if (!prenoms.trim() || !nom.trim()) { setNomErr('Prénom et nom sont requis.'); return }
    setSavingNom(true); setNomErr(null)
    try {
      const res = await fetch('/api/signatures/externe/nom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, prenoms: prenoms.trim(), nom: nom.trim() }),
      })
      const d = await res.json()
      if (res.ok) setNomExterne(d.nomExterne)
      else setNomErr(d.error ?? 'Erreur')
    } catch { setNomErr('Erreur réseau') }
    finally { setSavingNom(false) }
  }

  async function confirmSign() {
    setLoading(true); setErr(null)
    let sig_image: string
    try {
      sig_image = await captureSignatureImage()
    } catch {
      setLoading(false)
      setErr('Erreur lors de la génération de la signature. Réessayez.')
      return
    }
    const res = await fetch('/api/signatures/externe/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, sig_x: sigPos?.x ?? 50, sig_y: sigPos?.y ?? 80, sig_page: sigPage, sig_image }),
    })
    setLoading(false)
    if (res.ok) setSigned(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors de la signature') }
  }

  async function refuserSansSigner() {
    if (motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusing(true); setErr(null)
    const res = await fetch('/api/signatures/externe/refuse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, motif }),
    })
    setRefusing(false)
    if (res.ok) setRefused(true)
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur lors du refus') }
  }

  const sigBlock = policeChargee ? <SignatureBlock name={nomExterne ?? ''} date={today} hash={sigHash} /> : null

  const shellStyle: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9' }
  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }

  if (demandeComplete && !signed) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>ℹ️</div>
          <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Demande déjà finalisée</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Ce document a déjà été entièrement signé par toutes les parties.</p>
        </div>
      </div>
    )
  }

  if (refused) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>↩️</div>
          <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Signature refusée</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>L&apos;initiateur de la demande a été notifié de votre motif et pourra corriger le document avant de le renvoyer.</p>
        </div>
      </div>
    )
  }

  if (demandeRefusee && !signed) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Document en attente de correction</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Un signataire a demandé des corrections sur ce document. Vous recevrez un nouveau lien une fois la version corrigée renvoyée.</p>
        </div>
      </div>
    )
  }

  if (signed) {
    return (
      <div style={shellStyle}>
        <div style={{ ...cardStyle, maxWidth: 520 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#166534', marginBottom: 8, fontSize: 20 }}>Document signé avec succès !</h2>
          <p style={{ color: '#374151', fontSize: 14 }}>Vous avez signé <strong>{titre}</strong> le {today}.</p>
          {nomExterne && policeChargee && (
            <div style={{ margin: '20px auto', display: 'inline-block' }}>
              <SignatureBlock name={nomExterne} date={today} hash={sigHash} />
            </div>
          )}
          {fichierUrl && (
            <button onClick={telechargerDocument}
              style={{ marginTop: 4, padding: '10px 24px', borderRadius: 8, background: 'white', color: '#166534', border: '1px solid #86efac', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%' }}>
              📥 Télécharger le document signé
            </button>
          )}
        </div>
      </div>
    )
  }

  // Étape 1 : capturer le nom et prénom du signataire externe
  if (!nomExterne) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
          <h2 style={{ color: '#111827', fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>Signature demandée</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            <strong>{titre}</strong> — avant de consulter et signer le document, indiquez votre nom et prénom.
          </p>
          <div style={{ textAlign: 'left', marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Prénom(s) *</label>
            <input value={prenoms} onChange={e => setPrenoms(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {nomErr && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', marginBottom: 14, textAlign: 'left' }}>{nomErr}</div>}
          <button onClick={submitNom} disabled={savingNom}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#16a34a', color: 'white', border: 'none', cursor: savingNom ? 'not-allowed' : 'pointer', opacity: savingNom ? 0.7 : 1 }}>
            {savingNom ? 'Enregistrement...' : 'Continuer →'}
          </button>
        </div>
      </div>
    )
  }

  // Étape 2 : consulter et signer le document
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 62%', background: '#525659', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
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
          {sigPos && !placingMode && zoneImposee && <span style={{ fontSize: 12, color: '#93c5fd', flexShrink: 0 }}>🔒 Zone imposée par l'expéditeur</span>}
          {sigPos && !placingMode && !zoneImposee && <span style={{ fontSize: 12, color: '#86efac', flexShrink: 0 }}>↕ Glissez pour repositionner</span>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {loadingDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
          ) : docError ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fca5a5', fontSize: 14, textAlign: 'center', padding: 32 }}>
              <span>⚠️ {docError}</span>
              <button onClick={() => setDocRetryCount(c => c + 1)}
                style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #6b7280', background: 'transparent', color: '#e5e7eb', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔄 Réessayer
              </button>
            </div>
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

        {numPages && numPages > 1 && (
          <div style={{ padding: '8px 16px', background: '#3d4043', borderTop: '1px solid #2a2d30', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
            <button onClick={() => goToPage(renderedPage - 1)} disabled={renderedPage <= 1}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: renderedPage <= 1 ? '#333' : '#555', color: renderedPage <= 1 ? '#666' : '#fff', cursor: renderedPage <= 1 ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              ‹ Précédent
            </button>
            <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>Page {renderedPage} / {numPages}</span>
            <button onClick={() => goToPage(renderedPage + 1)} disabled={renderedPage >= numPages}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #555', background: renderedPage >= numPages ? '#333' : '#555', color: renderedPage >= numPages ? '#666' : '#fff', cursor: renderedPage >= numPages ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              Suivant ›
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: '0 0 38%', padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <h2 style={{ margin: 0, fontSize: 19, color: '#111827', fontWeight: 700 }}>Votre signature</h2>
        {description && <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{description}</p>}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Nom complet</label>
          <input value={nomExterne} readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date de signature</label>
          <input value={today} readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Aperçu de la signature</label>
          {policeChargee
            ? <SignatureBlock name={nomExterne} date={today} hash={sigHash} small />
            : <div style={{ fontSize: 12, color: '#6b7280' }}>Chargement...</div>}
        </div>

        {docUrl && numPages && (
          <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#374151' }}>
            📄 Page <strong>{renderedPage}</strong> sur <strong>{numPages}</strong>
            {zoneImposee && renderedPage === sigPage && <span style={{ color: '#2563eb', marginLeft: 6 }}>— zone de signature ici</span>}
            {zoneImposee && renderedPage !== sigPage && <span style={{ color: '#6b7280', marginLeft: 6 }}>— signature en attente page {sigPage}</span>}
            {!zoneImposee && sigPos && <span style={{ color: '#16a34a', marginLeft: 6 }}>— signature placée ici</span>}
            {!zoneImposee && !sigPos && <span style={{ color: '#6b7280', marginLeft: 6 }}>— naviguez puis placez la signature</span>}
          </div>
        )}

        {docError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#991b1b' }}>
            ⚠️ {docError}
          </div>
        )}
        {!docUrl && !loadingDoc && !docError && (
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

        {err && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{err}</div>}

        {showRefuseForm && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
              Motif du refus * (min. 10 caractères)
            </label>
            <textarea
              value={motif} onChange={e => setMotif(e.target.value)} rows={3}
              placeholder="Expliquez les corrections à apporter avant de signer..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
          {(sigPos || (!docUrl && !loadingDoc && !docError)) && !showRefuseForm && (
            <button onClick={confirmSign} disabled={loading}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#16a34a', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signature en cours...' : '✅ Confirmer la signature'}
            </button>
          )}
          {!showRefuseForm && (
            <button onClick={() => { setShowRefuseForm(true); setErr(null) }}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'white', border: '1px solid #fecaca', color: '#b91c1c', cursor: 'pointer' }}>
              ✕ Refuser de signer
            </button>
          )}
          {showRefuseForm && (
            <button onClick={refuserSansSigner} disabled={refusing}
              style={{ padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#b91c1c', color: 'white', border: 'none', cursor: refusing ? 'not-allowed' : 'pointer', opacity: refusing ? 0.7 : 1 }}>
              {refusing ? 'Envoi...' : 'Confirmer le refus'}
            </button>
          )}
          {showRefuseForm && (
            <button onClick={() => { setShowRefuseForm(false); setMotif(''); setErr(null) }}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, background: 'white', border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer' }}>
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
