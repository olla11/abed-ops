'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      className="btn secondary"
      onClick={logout}
      disabled={loading}
      style={{ fontSize: 13 }}
    >
      {loading ? '...' : 'Déconnexion'}
    </button>
  )
}
