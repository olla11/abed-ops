'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function EmailConfirmedContent() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const s = params.get('status')
    if (s === 'ok') {
      setStatus('ok')
      return
    }
    if (s === 'expired') {
      setErrorMsg('Le lien de confirmation a expiré. Inscrivez-vous à nouveau pour en recevoir un nouveau.')
      setStatus('error')
      return
    }
    if (s === 'invalid' || s === 'error') {
      setErrorMsg('Le lien est invalide ou a déjà été utilisé.')
      setStatus('error')
      return
    }
    // Legacy: detect old Supabase hash errors (e.g. otp_expired in URL hash)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      setErrorMsg('Le lien de confirmation a expiré ou a déjà été utilisé.')
      setStatus('error')
      return
    }
    // No status param — shouldn't happen with new flow
    setErrorMsg('Paramètre manquant.')
    setStatus('error')
  }, [params])

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      padding: 16, background: 'var(--abed-bg, #f4f6f9)',
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        boxShadow: '0 4px 32px rgba(0,0,0,.10)',
        padding: 'clamp(24px, 5vw, 48px) clamp(16px, 5vw, 36px)',
        width: '100%', maxWidth: 480, textAlign: 'center',
      }}>

        {status === 'loading' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Vérification…</h2>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#166534', fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>Email confirmé !</h2>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 14, color: '#166534', fontWeight: 700, margin: '0 0 8px' }}>✅ Votre email est bien validé</p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                Votre compte est en attente d'activation par l'administrateur système.<br /><br />
                Vous recevrez un email dès que votre accès sera configuré.
              </p>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                💡 Contactez l'administrateur système directement pour accélérer l'activation.
              </p>
            </div>
            <Link href="/login" style={{ display: 'inline-block', background: '#16a34a', color: 'white', padding: '12px 32px', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Une erreur est survenue</h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
              {errorMsg || 'Impossible de confirmer votre email.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <Link href="/login" style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
                ← Retour à la connexion
              </Link>
              <Link href="/auth/inscription" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
                Créer un nouveau compte
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default function EmailConfirmedPage() {
  return (
    <Suspense>
      <EmailConfirmedContent />
    </Suspense>
  )
}
