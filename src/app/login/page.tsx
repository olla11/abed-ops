'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import Image from 'next/image'

const T = {
  fr: {
    title: 'Se connecter à votre compte',
    email: 'Email',
    emailPlaceholder: 'vous@exemple.com',
    password: 'Mot de passe',
    forgot: 'Mot de passe oublié ?',
    submit: 'Connexion',
    loading: 'Connexion…',
    noAccount: "Vous n'avez pas de compte ?",
    register: 'Inscrivez-vous',
  },
  en: {
    title: 'Sign in to your account',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    loading: 'Signing in…',
    noAccount: "Don't have an account?",
    register: 'Register',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  const t = T[lang]

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setErr(error.message); return }

    const { data: profile } = await supabase
      .from('profiles').select('must_change_password').eq('id', data.user.id).single()

    if (profile?.must_change_password) {
      router.push('/auth/changer-mot-de-passe')
    } else {
      router.push('/accueil')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      background: 'var(--abed-bg, #f4f6f9)',
    }}>
      {/* Lang switcher top-right */}
      <div style={{ position: 'fixed', top: 16, right: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Globe size={15} color="var(--abed-muted)" />
        <button
          onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
          style={{
            fontSize: 13, fontWeight: 700, border: '1px solid var(--abed-border)',
            borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
            background: 'white', color: 'var(--abed-text)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          {lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
      </div>

      {/* Card */}
      <div style={{
        background: 'white',
        borderRadius: 18,
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        padding: '40px 36px',
        width: 400,
        maxWidth: '100%',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Image
            src="/logoabed2.png"
            alt="Logo ABED"
            width={160}
            height={56}
            style={{ objectFit: 'contain' }}
            priority
          />
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 12, fontWeight: 500 }}>
            {t.title}
          </p>
        </div>

        <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
              {t.email} <span style={{ color: 'var(--abed-danger)' }}>*</span>
            </label>
            <input
              className="input"
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
              {t.password} <span style={{ color: 'var(--abed-danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Forgot */}
          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <a
              href="/auth/mot-de-passe-oublie"
              style={{ fontSize: 13, color: 'var(--abed-green)', textDecoration: 'none', fontWeight: 500 }}
            >
              {t.forgot}
            </a>
          </div>

          {err && (
            <p style={{ color: 'var(--abed-danger)', fontSize: 13, margin: 0 }}>{err}</p>
          )}

          {/* Submit */}
          <button
            className="btn"
            type="submit"
            disabled={loading}
            style={{
              width: '100%', justifyContent: 'center',
              padding: '13px 0', fontSize: 15, fontWeight: 700, borderRadius: 12,
              marginTop: 4,
            }}
          >
            {loading ? t.loading : t.submit}
          </button>
        </form>

        {/* Register link */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 24, marginBottom: 0 }}>
          {t.noAccount}{' '}
          <a
            href="/auth/inscription"
            style={{ color: 'var(--abed-green)', fontWeight: 700, textDecoration: 'none' }}
          >
            {t.register}
          </a>
        </p>
      </div>
    </div>
  )
}
