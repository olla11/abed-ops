'use client'
import { useEffect, useRef, useState } from 'react'
import { attendrePoliceSignature } from '@/lib/signature-font'

type SignMode = 'saisir' | 'dessiner' | 'importer' | 'enregistree'

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

  useEffect(() => { attendrePoliceSignature().then(() => setPoliceChargee(true)) }, [])

  const rawImage = mode === 'dessiner' ? drawnImage : mode === 'importer' ? importedImage : mode === 'enregistree' ? (signatureEnregistree ?? null) : null

  // Aperçu du nom saisi en cursive, rendu en canvas transparent — pas de
  // chrome (crochet/date/hash) contrairement au tampon PDF du circuit
  // formel : ici le tampon s'insère au fil du texte, une légende texte
  // (nom + date) suit juste à côté dans le document.
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

  useEffect(() => {
    let cancelled = false
    if (mode === 'saisir') {
      if (!policeChargee) { setPreview(null); return }
      rendreNomEnImage().then(url => { if (!cancelled) setPreview(url) })
    } else {
      setPreview(rawImage)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, policeChargee, rawImage])

  function handleImportFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportedImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function confirmer() {
    let image: string | null = preview
    if (mode === 'saisir') image = await rendreNomEnImage()
    if (!image) return
    onConfirm(image, saveAsDefault)
  }

  const peutConfirmer = mode === 'saisir' ? policeChargee : !!rawImage

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440 }}>
        <h3 style={{ marginBottom: 4, fontSize: 16 }}>Apposer ma signature</h3>
        <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 16px' }}>
          Insérée à l&apos;endroit du curseur dans le document.
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

        <div style={{ marginTop: 16, marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Aperçu</label>
          <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--abed-border)', borderRadius: 8, background: '#fafafa' }}>
            {preview ? <img src={preview} alt="Aperçu de la signature" style={{ maxHeight: 50, maxWidth: '100%' }} /> : <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun aperçu pour l&apos;instant.</span>}
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
