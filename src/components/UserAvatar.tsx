'use client'
import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Settings, User, Wrench, LogOut } from 'lucide-react'

type Props = {
  userName?: string
  userRole?: string
  avatarUrl?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', rh: 'RH', caf: 'CAF', de: 'DE', aaf: 'AAF',
  administrateur: 'Administrateur', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

export default function UserAvatar({ userName, userRole, avatarUrl }: Props) {
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const initials = (userName ?? '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('')

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function fmtDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
    if (diffMin < 1) return "à l'instant"
    if (diffMin < 60) return `il y a ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `il y a ${diffH}h`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          width: 38, height: 38, borderRadius: '50%',
          background: avatarUrl ? 'transparent' : 'var(--abed-green)',
          border: '2px solid var(--abed-green)',
          cursor: 'pointer', overflow: 'visible',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatarUrl ? 'transparent' : 'var(--abed-green)' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName ?? ''} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
          ) : (
            <span style={{ color: 'white', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>{initials}</span>
          )}
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid var(--abed-border)',
          borderRadius: 10, width: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{userName}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</div>
          </div>

          <div>
            {([
              ...(['caf', 'admin'].includes(userRole ?? '') ? [{ href: '/parametres', label: 'Paramètres', icon: <Settings size={15} /> }] : []),
              { href: '/profile', label: tc('profile'), icon: <User size={15} /> },
              ...(userRole === 'admin' ? [{ href: '/admin', label: 'Administration', icon: <Wrench size={15} /> }] : []),
            ] as { href: string; label: string; icon: React.ReactNode }[]).map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', fontSize: 13, color: '#374151',
                textDecoration: 'none', borderBottom: '1px solid #f3f4f6',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <span style={{ color: '#6b7280', display: 'flex' }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button onClick={signOut} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
              padding: '10px 16px', fontSize: 13, color: '#dc2626',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <LogOut size={15} />
              {tc('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
