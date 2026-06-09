'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import PasswordCriteria, { isPasswordStrong } from './PasswordCriteria'

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

  // Password change
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdMsgType, setPwdMsgType] = useState<'ok' | 'err'>('ok')
  const [pwdLoading, setPwdLoading] = useState(false)
  const supabase = createClient()

  async function changePassword() {
    setPwdMsg(''); setPwdLoading(true)
    if (!isPasswordStrong(newPwd)) {
      setPwdMsg('Le nouveau mot de passe ne respecte pas tous les critères.')
      setPwdMsgType('err'); setPwdLoading(false); return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg('Les deux mots de passe ne correspondent pas.')
      setPwdMsgType('err'); setPwdLoading(false); return
    }
    if (newPwd === oldPwd) {
      setPwdMsg('Le nouveau mot de passe doit être différent de l\'ancien.')
      setPwdMsgType('err'); setPwdLoading(false); return
    }
    // Verify old password by signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: profile.email, password: oldPwd,
    })
    if (signInErr) {
      setPwdMsg('Mot de passe actuel incorrect.')
      setPwdMsgType('err'); setPwdLoading(false); return
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setPwdLoading(false)
    if (error) {
      setPwdMsg(error.message); setPwdMsgType('err')
    } else {
      setPwdMsg('Mot de passe modifié avec succès.')
      setPwdMsgType('ok')
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
    }
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

      {/* ── Changer le mot de passe ── */}
      <div style={{ borderTop: '1px solid var(--abed-border)', paddingTop: 24, marginTop: 8 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16, color: '#374151' }}>🔒 Modifier le mot de passe</h3>

        <div className="field">
          <label className="label">Mot de passe actuel *</label>
          <input className="input" type="password" value={oldPwd}
            onChange={e => setOldPwd(e.target.value)} placeholder="••••••••" />
        </div>

        <div className="field">
          <label className="label">Nouveau mot de passe *</label>
          <input className="input" type="password" value={newPwd}
            onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
          <PasswordCriteria password={newPwd} />
        </div>

        <div className="field">
          <label className="label">Confirmer le nouveau mot de passe *</label>
          <input className="input" type="password" value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••"
            style={{ borderColor: confirmPwd && confirmPwd !== newPwd ? '#ef4444' : undefined }} />
          {confirmPwd && confirmPwd !== newPwd && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {pwdMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
            background: pwdMsgType === 'ok' ? '#dcfce7' : '#fee2e2',
            color: pwdMsgType === 'ok' ? '#166534' : '#991b1b',
          }}>{pwdMsg}</div>
        )}

        <button className="btn secondary" onClick={changePassword}
          disabled={pwdLoading || !oldPwd || !newPwd || !confirmPwd}>
          {pwdLoading ? 'Modification…' : '🔒 Changer le mot de passe'}
        </button>
      </div>
    </div>
  )
}
