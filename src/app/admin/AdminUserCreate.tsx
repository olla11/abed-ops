'use client'
import { useState } from 'react'

export default function AdminUserCreate() {
  const [form, setForm] = useState({
    email: '', password: '', nom: '', prenoms: '', telephone: '', fonction: '',
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
      setForm({ email: '', password: '', nom: '', prenoms: '', telephone: '', fonction: '' })
    } else {
      setMsg({ ok: false, text: data.error ?? 'Erreur inconnue' })
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
      <div className="field">
        <label className="label">Mot de passe provisoire *</label>
        <input className="input" type="password" minLength={8} value={form.password}
          onChange={e => set('password', e.target.value)} required />
      </div>
      <div className="field">
        <label className="label">Téléphone (MTN MoMo)</label>
        <input className="input" placeholder="ex: 22961000000" value={form.telephone}
          onChange={e => set('telephone', e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Fonction / poste</label>
        <input className="input" value={form.fonction} onChange={e => set('fonction', e.target.value)} />
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
