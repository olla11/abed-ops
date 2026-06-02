'use client'
import { useState, useRef } from 'react'

type Props = {
  hasSignature: boolean
  hasCachet: boolean
}

export default function ProfileAssetForm({ hasSignature, hasCachet }: Props) {
  const [sigStatus, setSigStatus] = useState<string>(hasSignature ? 'Signature déjà enregistrée' : '')
  const [cachetStatus, setCachetStatus] = useState<string>(hasCachet ? 'Cachet déjà enregistré' : '')
  const sigRef = useRef<HTMLInputElement>(null)
  const cachetRef = useRef<HTMLInputElement>(null)

  async function upload(type: 'signature' | 'cachet', setStatus: (s: string) => void) {
    const input = type === 'signature' ? sigRef.current : cachetRef.current
    const file = input?.files?.[0]
    if (!file) { setStatus('Veuillez choisir un fichier'); return }
    setStatus('Envoi en cours...')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/profile/upload-asset', { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok) {
      setStatus('✓ Enregistré avec succès')
    } else {
      setStatus('Erreur : ' + (json.error ?? 'inconnue'))
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Signature &amp; Cachet pour les OM</h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--abed-muted)' }}>
        Les images que vous téléversez seront utilisées automatiquement dans les PDF d'ordre de mission.
        Format recommandé : PNG fond transparent ou blanc, max 2 Mo.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Signature</label>
          <input ref={sigRef} type="file" accept="image/*" style={{ display: 'block', marginBottom: 8 }} />
          <button className="btn" onClick={() => upload('signature', setSigStatus)}>Enregistrer</button>
          {sigStatus && <p style={{ fontSize: 12, marginTop: 6, color: sigStatus.startsWith('✓') ? 'green' : 'var(--abed-muted)' }}>{sigStatus}</p>}
        </div>

        <div>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Cachet (tampon)</label>
          <input ref={cachetRef} type="file" accept="image/*" style={{ display: 'block', marginBottom: 8 }} />
          <button className="btn" onClick={() => upload('cachet', setCachetStatus)}>Enregistrer</button>
          {cachetStatus && <p style={{ fontSize: 12, marginTop: 6, color: cachetStatus.startsWith('✓') ? 'green' : 'var(--abed-muted)' }}>{cachetStatus}</p>}
        </div>
      </div>
    </div>
  )
}
