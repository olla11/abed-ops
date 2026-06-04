'use client'
import { useState } from 'react'

type Profile = {
  nom: string
  prenoms: string
  civilite: string
  email: string
  telephone: string | null
  ifu: string | null
  fonction: string | null
  role: string
}

const CIVILITES = ['M.', 'Mme', 'Dr', 'Pr']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  rh: 'Ressources Humaines',
  caf: 'Comptable / CAF',
  de: 'Directeur Exécutif',
  manager: 'Manager',
  missionnaire: 'Missionnaire',
  prestataire: 'Prestataire',
}

export default function ProfileEditForm({ profile }: { profile: Profile }) {
  const [nom, setNom] = useState(profile.nom)
  const [prenoms, setPrenoms] = useState(profile.prenoms)
  const [civilite, setCivilite] = useState(profile.civilite || 'M.')
  const [telephone, setTelephone] = useState(profile.telephone || '')
  const [ifu, setIfu] = useState(profile.ifu || '')
  const [fonction, setFonction] = useState(profile.fonction || '')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true); setMsg('')
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, prenoms, civilite, telephone, ifu, fonction }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setMsg(data.error ?? 'Erreur'); setMsgType('err') }
    else { setMsg('Profil mis à jour.'); setMsgType('ok') }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Infos non modifiables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Email</label>
          <input className="input" value={profile.email} disabled
            style={{ background: 'var(--abed-bg)', color: 'var(--abed-muted)' }} />
        </div>
        <div className="field">
          <label className="label">Rôle</label>
          <input className="input" value={ROLE_LABELS[profile.role] ?? profile.role} disabled
            style={{ background: 'var(--abed-bg)', color: 'var(--abed-muted)' }} />
        </div>
      </div>

      {/* Infos modifiables */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Civilité</label>
          <select className="input" value={civilite} onChange={e => setCivilite(e.target.value)}>
            {CIVILITES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Nom *</label>
          <input className="input" value={nom} onChange={e => setNom(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Prénoms *</label>
          <input className="input" value={prenoms} onChange={e => setPrenoms(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Téléphone (MTN MoMo)</label>
          <input className="input" value={telephone} onChange={e => setTelephone(e.target.value)}
            placeholder="Ex: 96000000" />
        </div>
        <div className="field">
          <label className="label">IFU</label>
          <input className="input" value={ifu} onChange={e => setIfu(e.target.value)}
            placeholder="Numéro IFU" />
        </div>
      </div>

      <div className="field">
        <label className="label">Fonction / Poste</label>
        <input className="input" value={fonction} onChange={e => setFonction(e.target.value)}
          placeholder="Ex: Chargé de programme" />
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: msgType === 'ok' ? '#dcfce7' : '#fee2e2',
          color: msgType === 'ok' ? '#166534' : '#991b1b',
        }}>{msg}</div>
      )}

      <button className="btn" onClick={save} disabled={loading}>
        {loading ? 'Enregistrement…' : 'Enregistrer les modifications'}
      </button>
    </div>
  )
}
