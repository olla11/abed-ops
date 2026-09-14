'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, LogOut } from 'lucide-react'

type Variant = 'success' | 'logout'

// Petit message de confirmation transitoire après connexion/déconnexion —
// posé via sessionStorage juste avant la redirection (voir login/page.tsx,
// LogoutButton.tsx, UserAvatar.tsx, InactivityLogout.tsx) puis affiché ici
// au premier montage suivant, quelle que soit la page d'atterrissage.
// Stocké en JSON {message, variant} — variant distingue le vert (connexion)
// du rouge (déconnexion), avec repli sur une ancienne valeur en texte brut
// (variant 'success') si jamais un onglet a déjà écrit l'ancien format.
export default function AuthToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const [variant, setVariant] = useState<Variant>('success')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const stored = sessionStorage.getItem('abed_auth_toast')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { message: string; variant?: Variant }
          setMsg(parsed.message)
          setVariant(parsed.variant ?? 'success')
        } catch {
          setMsg(stored)
          setVariant('success')
        }
        sessionStorage.removeItem('abed_auth_toast')
        timer = setTimeout(() => setMsg(null), 3500)
      }
    } catch { /* sessionStorage indisponible (navigation privée...) — tant pis, pas de toast */ }
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  if (!msg) return null

  const estDeconnexion = variant === 'logout'

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: 8,
      background: estDeconnexion ? '#991b1b' : '#166534', color: 'white',
      padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,.15)',
    }}>
      {estDeconnexion ? <LogOut size={18} /> : <CheckCircle2 size={18} />}
      {msg}
    </div>
  )
}
