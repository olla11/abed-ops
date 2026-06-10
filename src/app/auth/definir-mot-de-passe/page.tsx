'use client'
export const dynamic = 'force-dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import PasswordCriteria, { isPasswordStrong } from '@/components/PasswordCriteria'

function DefinirMotDePasse() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [state, setState] = useState<'verifying' | 'ready' | 'invalid'>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Vérifie le jeton du lien reçu par email et ouvre une session temporaire.
  useEffect(() => {
    const token_hash = params.get('token_hash')
    const type = (params.get('type') ?? 'recovery') as 'recovery' | 'invite' | 'email'
    if (!token_hash) { setState('invalid'); return }
    supabase.auth
      .verifyOtp({ type, token_hash })
      .then(({ error }) => setState(error ? 'invalid' : 'ready'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isPasswordStrong(password)) {
      setErr('Le mot de passe ne respecte pas tous les critères requis.')
      return
    }
    if (password !== confirm) {
      setErr('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--abed-green)', letterSpacing: 1 }}>My ABED</div>
          <div style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, marginTop: 2 }}>
            Définir votre mot de passe
          </div>
        </div>

        {state === 'verifying' && (
          <p style={{ color: 'var(--abed-muted)', fontSize: 13, textAlign: 'center' }}>Vérification du lien…</p>
        )}

        {state === 'invalid' && (
          <div>
            <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>
              Ce lien est invalide ou a expiré. Demandez à l'administration de vous renvoyer une invitation.
            </p>
            <a className="btn" href="/login" style={{ width: '100%', justifyContent: 'center' }}>Retour à la connexion</a>
          </div>
        )}

        {state === 'ready' && !done && (
          <form onSubmit={submit}>
            <div className="field">
              <label className="label">Nouveau mot de passe</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required autoFocus />
              <PasswordCriteria password={password} />
            </div>
            <div className="field">
              <label className="label">Confirmer le mot de passe</label>
              <input className="input" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Enregistrement…' : 'Définir mon mot de passe'}
            </button>
          </form>
        )}

        {done && (
          <p style={{ color: 'var(--abed-green)', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
            ✓ Mot de passe enregistré. Redirection…
          </p>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <DefinirMotDePasse />
    </Suspense>
  )
}
