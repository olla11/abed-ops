'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'

type Profile = {
  nom: string
  prenoms: string
  civilite: string
  email: string
  telephone: string | null
  ifu: string | null
  fonction: string | null
  role: string
  adresse: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  avatar_url?: string | null
}

const CIVILITES = ['M.', 'Mme', 'Dr', 'Pr']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur système',
  administrateur: 'Administrateur (CA)',
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
  const [adresse, setAdresse] = useState(profile.adresse || '')
  const [dateNaissance, setDateNaissance] = useState(profile.date_naissance || '')
  const [lieuNaissance, setLieuNaissance] = useState(profile.lieu_naissance || '')
  const [nationalite, setNationalite] = useState(profile.nationalite || '')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadAvatar(file: File) {
    setAvatarLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profile/upload-avatar', { method: 'POST', body: fd })
    const data = await res.json()
    setAvatarLoading(false)
    if (data.ok) setAvatarUrl(data.url)
    else { setMsg(data.error ?? 'Erreur upload'); setMsgType('err') }
  }

  async function save() {
    setLoading(true); setMsg('')
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, prenoms, civilite, telephone, ifu, fonction, adresse, date_naissance: dateNaissance, lieu_naissance: lieuNaissance, nationalite }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setMsg(data.error ?? 'Erreur'); setMsgType('err') }
    else { setMsg('Profil mis à jour.'); setMsgType('ok') }
  }

  const initials = `${prenoms} ${nom}`.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--abed-border)' }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="avatar" width={80} height={80}
              style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--abed-border)' }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'var(--abed-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: 'white',
            }}>{initials || '?'}</div>
          )}
          {avatarLoading && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20,
            }}>⟳</div>
          )}
        </div>
        <div>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 8px' }}>
            Photo de profil (jpg, png, webp — max 2 Mo)
          </p>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
          <button type="button" className="btn" style={{ fontSize: 13, padding: '6px 16px' }}
            onClick={() => fileRef.current?.click()} disabled={avatarLoading}>
            {avatarLoading ? 'Envoi…' : avatarUrl ? 'Changer la photo' : 'Choisir une photo'}
          </button>
        </div>
      </div>
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

      <div className="field">
        <label className="label">Adresse complète</label>
        <input className="input" value={adresse} onChange={e => setAdresse(e.target.value)}
          placeholder="Quartier, ville…" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Date de naissance</label>
          <input className="input" type="date" value={dateNaissance}
            onChange={e => setDateNaissance(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Lieu de naissance</label>
          <input className="input" value={lieuNaissance} onChange={e => setLieuNaissance(e.target.value)}
            placeholder="Ville, pays" />
        </div>
      </div>

      <div className="field">
        <label className="label">Nationalité</label>
        <input className="input" value={nationalite} onChange={e => setNationalite(e.target.value)}
          placeholder="Ex: Béninoise" />
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
