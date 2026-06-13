'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setErr(error.message)
    else router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--abed-green)', letterSpacing: 1 }}>My ABED</div>
          <div style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, marginTop: 2 }}>
            Bienvenue sur My ABED
          </div>
        </div>
        <form onSubmit={signIn}>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <a href="/auth/mot-de-passe-oublie" style={{ fontSize: 13, color: 'var(--abed-green)', textDecoration: 'none' }}>
              Mot de passe oublié ?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
