'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function GoConfirm() {
  const params = useSearchParams()
  const [clicked, setClicked] = useState(false)

  function getUrl(): string | null {
    const encoded = params.get('to')
    if (!encoded) return null
    try {
      const url = atob(encoded)
      if (url.includes('supabase.co/auth') || url.includes('supabase.com/auth')) return url
    } catch {}
    return null
  }

  function handleClick() {
    const url = getUrl()
    if (!url) return
    setClicked(true)
    window.location.href = url
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f6f9', padding: 24 }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 32px',
        textAlign: 'center', maxWidth: 420, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
          Confirmez votre adresse email
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px' }}>
          Cliquez sur le bouton ci-dessous pour valider votre compte My ABED.
        </p>
        <button
          onClick={handleClick}
          disabled={clicked}
          style={{
            display: 'block', width: '100%',
            background: clicked ? '#86efac' : '#16a34a',
            color: 'white', border: 'none', borderRadius: 10,
            padding: '14px 0', fontSize: 15, fontWeight: 700,
            cursor: clicked ? 'default' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {clicked ? 'Redirection…' : '✅ Valider mon email'}
        </button>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          Ce lien est à usage unique. Si vous n&apos;avez pas créé de compte, ignorez cet email.
        </p>
      </div>
    </div>
  )
}

export default function GoPage() {
  return (
    <Suspense>
      <GoConfirm />
    </Suspense>
  )
}
