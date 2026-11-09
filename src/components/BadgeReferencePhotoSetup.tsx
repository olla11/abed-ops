'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, RotateCcw } from 'lucide-react'
import { calculerGabaritVisage, chargerModelesVisage } from '@/lib/face-client'

// Configuration unique, avant le tout premier badgeage : la photo prise ici
// sert de référence pour reconnaître l'employé lors d'un changement
// d'appareil (voir BadgePointageClient). Distincte de la photo de profil
// (qui peut être n'importe quelle image) — celle-ci doit être un vrai
// visage net, vérifié au moment de la capture (sinon rejetée).
export default function BadgeReferencePhotoSetup({ onConfigure }: { onConfigure: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [capture, setCapture] = useState<{ blob: Blob; dataUrl: string; descriptor: number[] } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [consentement, setConsentement] = useState(false)

  useEffect(() => {
    let annule = false
    async function demarrer() {
      try {
        await chargerModelesVisage()
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (annule) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setChargement(false)
      } catch {
        if (!annule) { setErreur('Impossible d\'accéder à la caméra. Vérifiez les autorisations de votre navigateur.'); setChargement(false) }
      }
    }
    demarrer()
    return () => { annule = true; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  async function capturer() {
    setErreur(null)
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    const descriptor = await calculerGabaritVisage(canvas)
    if (!descriptor) { setErreur('Aucun visage net détecté — placez-vous bien en face, dans un endroit bien éclairé.'); return }

    canvas.toBlob(blob => {
      if (!blob) return
      setCapture({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.9), descriptor })
    }, 'image/jpeg', 0.9)
  }

  function reprendre() {
    setCapture(null)
    setErreur(null)
  }

  async function confirmer() {
    if (!capture) return
    setEnvoi(true); setErreur(null)
    const form = new FormData()
    form.append('file', capture.blob, 'badge-reference.jpg')
    form.append('descriptor', JSON.stringify(capture.descriptor))
    const res = await fetch('/api/profile/badge-reference', { method: 'POST', body: form })
    const json = await res.json()
    setEnvoi(false)
    if (!res.ok) { setErreur(json.error ?? 'Échec de l\'enregistrement.'); return }
    streamRef.current?.getTracks().forEach(t => t.stop())
    onConfigure()
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6, fontSize: 15 }}>Configuration requise avant le premier badgeage</h3>
      <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Une photo de référence de votre visage est nécessaire pour vérifier votre identité si vous changez
        d&apos;appareil. Elle n&apos;est utilisée que pour cette vérification.
      </p>

      {erreur && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
          {erreur}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#111', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        {capture ? (
          <img src={capture.dataUrl} alt="Photo capturée" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {!capture ? (
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={capturer} disabled={chargement || !!erreur && chargement}>
          <Camera size={16} /> {chargement ? 'Chargement de la caméra…' : 'Prendre la photo'}
        </button>
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#374151', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={consentement} onChange={e => setConsentement(e.target.checked)} style={{ marginTop: 2 }} />
            J&apos;autorise ABED-ONG à utiliser cette photo pour vérifier mon identité lors du badgeage, conformément à la politique de confidentialité.
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={reprendre} disabled={envoi}>
              <RotateCcw size={15} /> Reprendre
            </button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmer} disabled={envoi || !consentement}>
              <CheckCircle2 size={15} /> {envoi ? 'Enregistrement…' : 'Confirmer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
