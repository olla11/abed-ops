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

type Etape = 'idle' | 'localisation' | 'justification' | 'camera' | 'envoi'

export default function BadgePointageClient({ aReferencePhoto, pointagesDuJour }: {
  aReferencePhoto: boolean
  pointagesDuJour: Pointage[]
}) {
  const [referenceConfiguree, setReferenceConfiguree] = useState(aReferencePhoto)
  const [historique, setHistorique] = useState(pointagesDuJour)
  const [etape, setEtape] = useState<Etape>('idle')
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [justificationTexte, setJustificationTexte] = useState('')
  const [typeAJustifier, setTypeAJustifier] = useState<'entree' | 'sortie' | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const positionRef = useRef<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const justificationRef = useRef<string>('')

  useEffect(() => {
    chargerModelesVisage().catch(() => {}) // préchargement, pas bloquant
  }, [])

  const reussis = historique.filter(p => p.statut === 'reussi')
  const dernierType = reussis.at(-1)?.type
  const prochainType: 'entree' | 'sortie' = dernierType === 'entree' ? 'sortie' : 'entree'
  // Strictement 2 pointages par jour (1 entrée + 1 sortie) — voir
  // /api/badge/pointer, qui applique la même règle côté serveur.
  const journeeComplete = reussis.length >= 2

  function arreterCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function envoyerPointage(descriptor?: number[]) {
    if (!positionRef.current) return
    setEtape('envoi')
    const res = await fetch('/api/badge/pointer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...positionRef.current, deviceId: idAppareil(), descriptor, justification: justificationRef.current || undefined }),
    })
    const json = await res.json()

    if (res.ok && json.needsJustification) {
      setTypeAJustifier(json.type)
      setEtape('justification')
      return
    }

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
    justificationRef.current = ''
    setJustificationTexte('')
    setTypeAJustifier(null)
    setEtape('idle')
  }

  function confirmerJustification() {
    const texte = justificationTexte.trim()
    if (!texte) { setErreur('Merci de préciser un motif.'); return }
    justificationRef.current = texte
    setErreur(null)
    envoyerPointage()
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

      {etape === 'justification' ? (
        <div className="card">
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {typeAJustifier === 'entree' ? 'Entrée après 9h — merci de préciser le motif' : 'Sortie avant 17h — merci de préciser le motif'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
            Ce motif sera visible par les RH et votre manager.
          </p>
          <textarea
            value={justificationTexte}
            onChange={e => setJustificationTexte(e.target.value)}
            placeholder="Ex. rendez-vous médical, embouteillage, mission externe…"
            rows={3}
            maxLength={500}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={confirmerJustification}>
            Confirmer le badgeage
          </button>
        </div>
      ) : etape === 'camera' ? (
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
      ) : journeeComplete ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle2 size={22} color="#16a34a" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Journée terminée</p>
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Entrée et sortie déjà enregistrées aujourd&apos;hui.
          </p>
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
