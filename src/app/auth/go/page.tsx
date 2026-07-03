'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function GoRedirect() {
  const params = useSearchParams()

  useEffect(() => {
    const encoded = params.get('to')
    if (!encoded) return
    try {
      const url = atob(encoded)
      // Only allow redirects to Supabase auth URLs
      if (url.includes('supabase.co/auth') || url.includes('supabase.com/auth')) {
        window.location.href = url
      }
    } catch {
      // invalid base64 — ignore
    }
  }, [params])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--abed-bg, #f4f6f9)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <p style={{ fontSize: 14, color: '#6b7280' }}>Redirection en cours…</p>
      </div>
    </div>
  )
}

export default function GoPage() {
  return (
    <Suspense>
      <GoRedirect />
    </Suspense>
  )
}
