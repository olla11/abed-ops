'use client'
import { useEffect, useRef, useState } from 'react'
import { LogIn, LogOut, MapPin, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { calculerGabaritVisage, chargerModelesVisage } from '@/lib/face-client'
import BadgeReferencePhotoSetup from './BadgeReferencePhotoSetup'

type Pointage = { id: string; type: 'entree' | 'sortie'; statut: string; horodatage: string }

const CLE_DEVICE_ID = 'abed_badge_device_id'

function idAppareil(): string {
  try {
    let id = localStorage.getItem(CLE_DEVICE_ID)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(CLE_DEVICE_ID, id) }
    return id
  } catch {
    // Stockage indisponible (navigation privée stricte...) — identifiant
    // jetable pour cette session : déclenchera systématiquement la
    // vérification faciale, ce qui reste sûr (juste moins pratique).
    return crypto.randomUUID()
  }
}

function fmtHeure(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

type Etape = 'idle' | 'localisation' | 'camera' | 'envoi'

export default function BadgePointageClient({ aReferencePhoto, pointagesDuJour }: {
  aReferencePhoto: boolean
  pointagesDuJour: Pointage[]
}) {
  const [referenceConfiguree, setReferenceConfiguree] = useState(aReferencePhoto)
  const [historique, setHistorique] = useState(pointagesDuJour)
  const [etape, setEtape] = useState<Etape>('idle')
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const positionRef = useRef<{ latitude: number; longitude: number; accuracy: number } | null>(null)

  useEffect(() => {
    chargerModelesVisage().catch(() => {}) // préchargement, pas bloquant
  }, [])

  const dernierType = historique.filter(p => p.statut === 'reussi').at(-1)?.type
  const prochainType: 'entree' | 'sortie' = dernierType === 'entree' ? 'sortie' : 'entree'

  function arreterCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function envoyerPointage(descriptor?: number[]) {
    if (!positionRef.current) return
    setEtape('envoi')
    const res = await fetch('/api/badge/pointer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...positionRef.current, deviceId: idAppareil(), descriptor }),
    })
    const json = await res.json()

    if (res.ok && json.needsFaceVerification) {
      setEtape('camera')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setErreur('Nouvel appareil détecté : la caméra est nécessaire pour vérifier votre identité, mais son accès a été refusé.')
        setEtape('idle')
      }
      return
    }

    arreterCamera()
    if (!res.ok) { setErreur(json.error ?? 'Échec du badgeage.'); setEtape('idle'); return }

    setSucces(`${json.pointage.type === 'entree' ? 'Entrée' : 'Sortie'} enregistrée à ${fmtHeure(json.pointage.horodatage)}.`)
    setHistorique(h => [...h, json.pointage])
    setEtape('idle')
  }

  function demarrer() {
    setErreur(null); setSucces(null)
    setEtape('localisation')
    if (!navigator.geolocation) { setErreur('La géolocalisation n\'est pas disponible sur cet appareil.'); setEtape('idle'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        positionRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }
        envoyerPointage()
      },
      () => { setErreur('Position GPS refusée ou indisponible — autorisez la localisation pour badger.'); setEtape('idle') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  async function capturerEtVerifier() {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const descriptor = await calculerGabaritVisage(canvas)
    if (!descriptor) { setErreur('Aucun visage net détecté — réessayez avec un meilleur éclairage.'); return }
    envoyerPointage(descriptor)
  }

  if (!referenceConfiguree) {
    return <BadgeReferencePhotoSetup onConfigure={() => setReferenceConfiguree(true)} />
  }

  return (
    <div>
      {succes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
          <CheckCircle2 size={16} /> {succes}
        </div>
      )}
      {erreur && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
          <AlertTriangle size={16} /> {erreur}
        </div>
      )}

      {etape === 'camera' ? (
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Nouvel appareil détecté — vérification d&apos;identité</p>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#111', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={capturerEtVerifier}>
            <Camera size={16} /> Vérifier mon identité
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
            <MapPin size={13} style={{ verticalAlign: -2 }} /> Votre position doit être à proximité immédiate du bureau.
          </p>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center', padding: '16px 0', fontSize: 16, background: prochainType === 'entree' ? 'var(--abed-green)' : '#b45309' }}
            onClick={demarrer}
            disabled={etape !== 'idle'}
          >
            {prochainType === 'entree' ? <LogIn size={19} /> : <LogOut size={19} />}
            {etape === 'idle' ? `Badger — ${prochainType === 'entree' ? 'Entrée' : 'Sortie'}`
              : etape === 'localisation' ? 'Localisation en cours…' : 'Enregistrement…'}
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Aujourd&apos;hui</h3>
        {historique.filter(p => p.statut === 'reussi').length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>Aucun badgeage aujourd&apos;hui.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historique.filter(p => p.statut === 'reussi').map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                {p.type === 'entree' ? <LogIn size={14} color="#16a34a" /> : <LogOut size={14} color="#b45309" />}
                <span style={{ fontWeight: 600 }}>{p.type === 'entree' ? 'Entrée' : 'Sortie'}</span>
                <span style={{ color: 'var(--abed-muted)' }}>{fmtHeure(p.horodatage)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
