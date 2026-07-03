'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const supabase = createClient()
    const appUrl = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/nouveau-mot-de-passe`,
    })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setDone(true)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '48px 36px', width: 420, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
        <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Vérifiez votre email</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
          Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien pour réinitialiser votre mot de passe.
        </p>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 28px' }}>
          Le lien est valable 1 heure.
        </p>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>Mot de passe oublié</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Adresse email
            </label>
            <input
              style={inp}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="vous@exemple.com"
              autoFocus
            />
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--abed-green)', color: 'white', border: 'none',
              borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20, marginBottom: 0 }}>
          <Link href="/login" style={{ color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
