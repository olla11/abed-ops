'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Detect Supabase error in URL hash (e.g. #error=access_denied&error_code=otp_expired)
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const code = params.get('error_code') ?? ''
      const desc = params.get('error_description') ?? ''
      if (code === 'otp_expired' || desc.toLowerCase().includes('expired') || desc.toLowerCase().includes('invalid')) {
        setErrorMsg('Le lien de confirmation a expiré ou a déjà été utilisé.')
      } else {
        setErrorMsg(desc.replace(/\+/g, ' ') || 'Une erreur est survenue.')
      }
      setStatus('error')
      return
    }

    async function confirm() {
      try {
        const res = await fetch('/api/auth/confirm-registration', { method: 'POST' })
        const data = await res.json()
        if (data.ok) {
          setStatus('ok')
          const supabase = createClient()
          await supabase.auth.signOut()
        } else {
          setErrorMsg(data.error ?? 'Impossible de confirmer votre email.')
          setStatus('error')
        }
      } catch {
        setErrorMsg('Erreur réseau. Veuillez réessayer.')
        setStatus('error')
      }
    }
    confirm()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      padding: '16px', background: 'var(--abed-bg, #f4f6f9)',
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
            <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Confirmation en cours…</h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Veuillez patienter.</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#166534', fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>Email confirmé !</h2>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 14, color: '#166534', fontWeight: 700, margin: '0 0 8px' }}>✅ Votre email est bien validé</p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                Votre compte est en attente d'activation par l'administrateur système.<br /><br />
                Vous recevrez un email dès que votre accès sera configuré.
              </p>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                💡 Contactez l'administrateur système directement pour accélérer l'activation.
              </p>
            </div>
            <Link href="/login" style={{ display: 'inline-block', background: 'var(--abed-green)', color: 'white', padding: '12px 32px', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Une erreur est survenue</h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
              {errorMsg || 'Impossible de confirmer votre email.'}
            </p>
            {errorMsg.includes('expiré') && (
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
                Inscrivez-vous à nouveau pour recevoir un nouveau lien.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 20 }}>
              <Link href="/login" style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
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
