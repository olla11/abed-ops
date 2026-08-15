'use client'
import { useEffect, useRef, useState } from 'react'
import { attendrePoliceSignature } from '@/lib/signature-font'

type SignMode = 'saisir' | 'dessiner' | 'importer' | 'enregistree'
type StampOptions = { bracket: boolean; header: boolean; date: boolean; hash: boolean }

const BRACKET_COLOR = '#2563eb'

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

/**
 * Recadre un canvas transparent sur le contenu réellement dessiné — même
 * logique que SignerClient (signature du circuit PDF), dupliquée ici
 * volontairement pour ne jamais toucher ce circuit déjà en production.
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
      if (data[(y * width + x) * 4 + 3] > 10) {
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

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
  function start(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); drawingRef.current = true; lastRef.current = pos(e) }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return
    e.preventDefault()
    const p = pos(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(lastRef.current.x, lastRef.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    lastRef.current = p; hasDrawnRef.current = true
  }
  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (hasDrawnRef.current && canvasRef.current) onChange(trimTransparentCanvas(canvasRef.current))
  }
  function effacer() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: '100%', height: 140, background: 'repeating-conic-gradient(#f3f4f6 0% 25%, white 0% 50%) 50% / 16px 16px', border: '1px dashed #d1d5db', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }}
      />
      <button type="button" onClick={effacer} style={{ marginTop: 6, fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#6b7280' }}>
        Effacer
      </button>
    </div>
  )
}

type Props = {
  userName: string
  signatureEnregistree?: string | null
  onConfirm: (image: string, saveAsDefault: boolean) => void
  onClose: () => void
}

export default function SignatureCaptureModal({ userName, signatureEnregistree, onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<SignMode>(signatureEnregistree ? 'enregistree' : 'saisir')
  const [drawnImage, setDrawnImage] = useState<string | null>(null)
  const [importedImage, setImportedImage] = useState<string | null>(null)
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [policeChargee, setPoliceChargee] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [options, setOptions] = useState<StampOptions>({ bracket: true, header: true, date: true, hash: true })

  useEffect(() => { attendrePoliceSignature().then(() => setPoliceChargee(true)) }, [])

  const rawImage = mode === 'dessiner' ? drawnImage : mode === 'importer' ? importedImage : mode === 'enregistree' ? (signatureEnregistree ?? null) : null

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const sigHash = shortHash(userName + today)

  // Rendu du nom saisi en cursive vers un PNG transparent, sans habillage —
  // sert de contenu au tampon de marque ci-dessous (même chemin que les
  // autres modes, qui fournissent directement leur image).
  async function rendreNomEnImage(): Promise<string> {
    await attendrePoliceSignature()
    const SCALE = 3
    const fontSize = 26 * SCALE
    const mesure = document.createElement('canvas').getContext('2d')!
    mesure.font = `${fontSize}px BrittanySignature`
    const w = mesure.measureText(userName).width
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(w + 16 * SCALE)
    canvas.height = Math.ceil(fontSize * 1.5)
    const ctx = canvas.getContext('2d')!
    ctx.font = `${fontSize}px BrittanySignature`
    ctx.fillStyle = '#000'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(userName, 8 * SCALE, fontSize)
    return canvas.toDataURL('image/png')
  }

  /**
   * Habille une image de contenu (nom cursif ou dessin/import/enregistrée)
   * dans le même tampon de marque que le circuit de signature PDF formel
   * (crochet bleu, en-tête "MyABED signed by:", séparateur, date + hash) —
   * porté ici depuis SignerClient volontairement dupliqué, pour ne jamais
   * toucher ce circuit déjà en production. Chaque élément peut être
   * désactivé (options) : la mise en page se resserre en conséquence plutôt
   * que de laisser un espace vide à la place de l'élément retiré.
   */
  async function habillerEnTampon(contentImage: string, opts: StampOptions): Promise<string> {
    const SCALE = 3
    const BH = 80 * SCALE
    const hookLen = 13 * SCALE
    const cornerRadius = Math.round(BH * 0.047)
    const bracketInset = Math.round(BH * 0.165)
    const bx = 2 * SCALE
    const textX = bx + (opts.bracket ? hookLen + 8 * SCALE : 6 * SCALE)
    const hashTexte = `${sigHash.slice(0, 12)}...`
    const dateHashGap = 10 * SCALE
    const hasFooter = opts.date || opts.hash

    const img = await loadImage(contentImage)
    const contentAreaTop = Math.round(BH * (opts.header ? 0.18 : 0.08))
    const contentAreaBottom = Math.round(BH * (hasFooter ? 0.66 : 0.86))
    const targetH = contentAreaBottom - contentAreaTop
    const maxW = 230 * SCALE
    const imgW = Math.min(maxW, targetH * (img.width / img.height))
    const imgH = imgW * (img.height / img.width)

    const mesure = document.createElement('canvas').getContext('2d')!
    let headerW = 0
    if (opts.header) {
      mesure.font = `bold ${9 * SCALE}px Arial, sans-serif`
      headerW = mesure.measureText('MYABED SIGNED BY:').width
    }
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

    ctx.drawImage(img, textX, contentAreaTop + (targetH - imgH) / 2, imgW, imgH)

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

  async function genererTampon(): Promise<string | null> {
    const content = mode === 'saisir' ? await rendreNomEnImage() : rawImage
    if (!content) return null
    return habillerEnTampon(content, options)
  }

  useEffect(() => {
    let cancelled = false
    if (mode === 'saisir' && !policeChargee) { setPreview(null); return }
    if (mode !== 'saisir' && !rawImage) { setPreview(null); return }
    genererTampon().then(url => { if (!cancelled) setPreview(url) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, policeChargee, rawImage, options])

  function handleImportFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportedImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function confirmer() {
    const image = preview ?? await genererTampon()
    if (!image) return
    onConfirm(image, saveAsDefault)
  }

  const peutConfirmer = mode === 'saisir' ? policeChargee : !!rawImage

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460 }}>
        <h3 style={{ marginBottom: 4, fontSize: 16 }}>Apposer ma signature</h3>
        <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 16px' }}>
          Insérée à l&apos;endroit du curseur dans le document — déplaçable et redimensionnable ensuite à la souris.
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
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

        {mode === 'dessiner' && <SignatureDrawPad onChange={setDrawnImage} />}

        {mode === 'importer' && (
          <div>
            <input type="file" accept="image/*" onChange={e => handleImportFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
            <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '6px 0 0' }}>Une image avec fond transparent (PNG) donne le meilleur résultat.</p>
          </div>
        )}

        {mode === 'enregistree' && !signatureEnregistree && (
          <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>
            Aucune signature enregistrée. Dessinez-en une ou importez-en une, puis cochez « Enregistrer ».
          </p>
        )}

        {(mode === 'dessiner' || mode === 'importer') && rawImage && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={saveAsDefault} onChange={e => setSaveAsDefault(e.target.checked)} />
            Enregistrer comme signature pour la prochaine fois
          </label>
        )}

        <div style={{ marginTop: 16 }}>
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

        <div style={{ marginTop: 16, marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Aperçu</label>
          <div style={{ minHeight: 90, display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--abed-border)', borderRadius: 8, background: '#fafafa' }}>
            {preview ? <img src={preview} alt="Aperçu de la signature" style={{ maxHeight: 80, maxWidth: '100%' }} /> : <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun aperçu pour l&apos;instant.</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
          <button onClick={confirmer} disabled={!peutConfirmer} style={{ padding: '9px 20px', borderRadius: 8, cursor: peutConfirmer ? 'pointer' : 'not-allowed', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: peutConfirmer ? 1 : 0.6 }}>
            Insérer ma signature
          </button>
        </div>
      </div>
    </div>
  )
}
