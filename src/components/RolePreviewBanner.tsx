'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ROLE_LABELS: Record<string, string> = {
  rh: 'RH', caf: 'CAF', de: 'Directeur Exécutif', aaf: 'AAF',
  administrateur: 'Administrateur (CA)', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

export default function RolePreviewBanner({ previewRole }: { previewRole: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function quit() {
    setLoading(true)
    await fetch('/api/admin/role-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: null }),
    })
    router.refresh()
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#f59e0b', color: '#1c1917',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: '10px 24px', fontSize: 14, fontWeight: 600,
      boxShadow: '0 -2px 12px rgba(0,0,0,.15)',
    }}>
      <span>👁 Mode aperçu — Vue &quot;{ROLE_LABELS[previewRole] ?? previewRole}&quot;</span>
      <button
        onClick={quit}
        disabled={loading}
        style={{
          background: '#1c1917', color: 'white', border: 'none', borderRadius: 6,
          padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {loading ? '…' : '✕ Quitter la simulation'}
      </button>
    </div>
  )
}
