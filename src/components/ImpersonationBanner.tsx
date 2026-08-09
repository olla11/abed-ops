'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const HEADER_HEIGHT = 60
const BANNER_HEIGHT = 44

const ROLE_LABELS: Record<string, string> = {
  rh: 'RH', caf: 'CAF', de: 'Directeur Exécutif', aaf: 'AAF',
  administrateur: 'Administrateur (CA)', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
  admin: 'Admin', dp: 'DP',
}

export default function ImpersonationBanner({
  adminNom, adminPrenoms, targetNom, targetPrenoms, targetRole,
}: {
  adminNom: string
  adminPrenoms: string
  targetNom: string
  targetPrenoms: string
  targetRole: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // La bannière se place sous le header fixe (60px) plutôt que par-dessus,
  // sinon elle masque le menu de navigation — on pousse le contenu de la
  // page d'autant pendant que la bannière est affichée.
  useEffect(() => {
    document.body.style.paddingTop = `${HEADER_HEIGHT + BANNER_HEIGHT}px`
    return () => {
      document.body.style.paddingTop = `${HEADER_HEIGHT}px`
    }
  }, [])

  async function quit() {
    setLoading(true)
    await fetch('/api/admin/impersonate/stop', { method: 'POST' })
    router.push('/admin/roles')
    router.refresh()
  }

  return (
    <div style={{
      position: 'fixed', top: HEADER_HEIGHT, left: 0, right: 0, zIndex: 190,
      height: BANNER_HEIGHT, boxSizing: 'border-box',
      background: '#dc2626', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: '0 24px', fontSize: 14, fontWeight: 600,
      boxShadow: '0 2px 12px rgba(0,0,0,.2)',
    }}>
      <span>
        🔴 Connecté en tant que <strong>{targetPrenoms} {targetNom}</strong> ({ROLE_LABELS[targetRole] ?? targetRole})
        — testé par {adminPrenoms} {adminNom}
      </span>
      <button
        onClick={quit}
        disabled={loading}
        style={{
          background: 'white', color: '#dc2626', border: 'none', borderRadius: 6,
          padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {loading ? '…' : '✕ Revenir à mon compte'}
      </button>
    </div>
  )
}
