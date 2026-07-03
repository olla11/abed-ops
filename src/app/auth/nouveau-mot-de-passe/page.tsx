'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}

export default function NouveauMotDePassePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (password !== confirm) { setErr('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 8) { setErr('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } else {
      const d = await res.json()
      setErr(d.error ?? 'Erreur inconnue')
    }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '48px 36px', width: 420, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: '#166534', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Mot de passe modifié !</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Vous allez être redirigé vers la connexion…
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>Nouveau mot de passe</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Choisissez un mot de passe sécurisé.</p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nouveau mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 42 }}
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={8}
                placeholder="Minimum 8 caractères"
                autoFocus
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Confirmer le mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 42 }}
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Répéter le mot de passe"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--abed-green)', color: 'white', border: 'none',
              borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Enregistrement…' : 'Définir mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
