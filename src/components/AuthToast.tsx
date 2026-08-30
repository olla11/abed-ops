'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

// Petit message de confirmation transitoire après connexion/déconnexion —
// posé via sessionStorage juste avant la redirection (voir login/page.tsx,
// LogoutButton.tsx, UserAvatar.tsx) puis affiché ici au premier montage
// suivant, quelle que soit la page d'atterrissage.
export default function AuthToast() {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const stored = sessionStorage.getItem('abed_auth_toast')
      if (stored) {
        setMsg(stored)
        sessionStorage.removeItem('abed_auth_toast')
        timer = setTimeout(() => setMsg(null), 3500)
      }
    } catch { /* sessionStorage indisponible (navigation privée...) — tant pis, pas de toast */ }
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  if (!msg) return null

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#166534', color: 'white',
      padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,.15)',
    }}>
      <CheckCircle2 size={18} />
      {msg}
    </div>
  )
}
