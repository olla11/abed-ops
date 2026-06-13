'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function ChangerMotDePassePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password !== confirm) { setErr('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 8) { setErr('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/dashboard')
    } else {
      const d = await res.json()
      setErr(d.error ?? 'Erreur')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', width: 400, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Image src="/logoabed2.png" alt="ABED" width={52} height={52} style={{ objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--abed-green)', marginBottom: 6 }}>Bienvenue sur My ABED</h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
            Pour votre sécurité, veuillez définir un nouveau mot de passe personnel avant de continuer.
          </p>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              required
              minLength={8}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Répéter le mot de passe"
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {err && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{err}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', opacity: loading ? .7 : 1 }}
          >
            {loading ? 'Enregistrement...' : 'Définir mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
