'use client'
import { useState } from 'react'

export default function AdminUserCreate() {
  const [form, setForm] = useState({
    email: '', password: '', nom: '', prenoms: '', civilite: 'M.',
    role: 'missionnaire', type_emploi: '',
    telephone: '', fonction: '', ifu: '',
    grade_indice: '', adresse: '',
    date_naissance: '', lieu_naissance: '', nationalite: 'Béninoise',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setMsg({ ok: true, text: `Compte créé pour ${form.prenoms} ${form.nom}` })
      setForm({ email: '', password: '', nom: '', prenoms: '', civilite: 'M.', role: 'missionnaire', type_emploi: '',
        telephone: '', fonction: '', ifu: '', grade_indice: '', adresse: '', date_naissance: '', lieu_naissance: '', nationalite: 'Béninoise' })
    } else {
      setMsg({ ok: false, text: data.error ?? 'Erreur inconnue' })
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Civilité</label>
          <select className="input" value={form.civilite} onChange={e => set('civilite', e.target.value)}>
            <option>M.</option>
            <option>Mme</option>
            <option>Dr</option>
            <option>Pr</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Nom *</label>
          <input className="input" value={form.nom} onChange={e => set('nom', e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Prénoms *</label>
          <input className="input" value={form.prenoms} onChange={e => set('prenoms', e.target.value)} required />
        </div>
      </div>

      <div className="field">
        <label className="label">Email *</label>
        <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Rôle *</label>
          <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="missionnaire">Missionnaire</option>
            <option value="prestataire">Prestataire</option>
            <option value="manager">Manager</option>
            <option value="aaf">AAF</option>
            <option value="caf">CAF</option>
            <option value="de">Directeur Exécutif</option>
            <option value="rh">RH</option>
            <option value="administrateur">Administrateur (CA)</option>
            <option value="admin">Admin système</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Type d&apos;emploi</label>
          <select className="input" value={form.type_emploi} onChange={e => set('type_emploi', e.target.value)}>
            <option value="">— Aucun —</option>
            <option value="cdi">CDI</option>
            <option value="cdd">CDD</option>
            <option value="benevole">Bénévole</option>
            <option value="stagiaire_n1">Stagiaire N1</option>
            <option value="stagiaire_n2">Stagiaire N2</option>
            <option value="prestataire_direct">Prestataire direct</option>
            <option value="prestataire_credit">Prestataire crédit</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Mot de passe provisoire *</label>
        <input className="input" type="password" minLength={8} value={form.password}
          onChange={e => set('password', e.target.value)} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Téléphone (MTN MoMo)</label>
          <input className="input" placeholder="ex : 22961000000" value={form.telephone}
            onChange={e => set('telephone', e.target.value)} />
        </div>
        <div className="field">
          <label className="label">IFU</label>
          <input className="input" placeholder="Numéro IFU" value={form.ifu}
            onChange={e => set('ifu', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Fonction / poste</label>
          <input className="input" value={form.fonction} onChange={e => set('fonction', e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Qualité / Grade / Indice</label>
          <input className="input" placeholder="ex : Chargé de programme" value={form.grade_indice}
            onChange={e => set('grade_indice', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label className="label">Adresse complète</label>
        <input className="input" placeholder="Quartier, ville…" value={form.adresse}
          onChange={e => set('adresse', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Date de naissance</label>
          <input className="input" type="date" value={form.date_naissance}
            onChange={e => set('date_naissance', e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Lieu de naissance</label>
          <input className="input" value={form.lieu_naissance}
            onChange={e => set('lieu_naissance', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label className="label">Nationalité</label>
        <input className="input" value={form.nationalite}
          onChange={e => set('nationalite', e.target.value)} />
      </div>

      {msg && (
        <p style={{ fontSize: 13, marginBottom: 12, color: msg.ok ? 'var(--abed-green)' : 'var(--abed-danger)' }}>
          {msg.text}
        </p>
      )}
      <button className="btn" disabled={loading}>{loading ? 'Création…' : 'Créer le compte'}</button>
    </form>
  )
}