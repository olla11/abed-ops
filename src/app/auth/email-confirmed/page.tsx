'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    async function confirm() {
      try {
        // Call API to update registration_status + send emails
        const res = await fetch('/api/auth/confirm-registration', { method: 'POST' })
        const data = await res.json()
        if (data.ok) {
          setStatus('ok')
          // Sign out so they can't access the app until admin activates
          const supabase = createClient()
          await supabase.auth.signOut()
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    }
    confirm()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--abed-bg, #f4f6f9)' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '48px 36px', width: 480, maxWidth: '100%', textAlign: 'center' }}>

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
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ fontSize: 14, color: '#166534', fontWeight: 700, margin: '0 0 8px' }}>✅ Votre email est bien validé</p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                Votre compte est maintenant en attente d'activation par l'administrateur système.<br /><br />
                Vous recevrez un email dès que votre compte sera activé et que votre accès sera configuré.
              </p>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                💡 En attendant, vous pouvez contacter l'administrateur système directement pour accélérer l'activation de votre compte.
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
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
              Impossible de confirmer votre email. Le lien a peut-être expiré. Contactez l'administrateur.
            </p>
            <Link href="/login" style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
              ← Retour à la connexion
            </Link>
          </>
        )}

      </div>
    </div>
  )
}
