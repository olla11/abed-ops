'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Settings, User, Wrench, LogOut } from 'lucide-react'

type Props = {
  userName?: string
  userRole?: string
  avatarUrl?: string | null
}

type Notif = {
  id: string
  message: string
  lien: string | null
  created_at: string
  lu: boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', rh: 'RH', caf: 'CAF', de: 'DE', aaf: 'AAF',
  administrateur: 'Administrateur', manager: 'Manager',
  missionnaire: 'Missionnaire', prestataire: 'Prestataire',
}

export default function UserAvatar({ userName, userRole, avatarUrl }: Props) {
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [tab, setTab] = useState<'menu' | 'notifs'>('menu')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const initials = (userName ?? '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('')

  const unread = notifs.filter(n => !n.lu).length

  const loadNotifs = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, message, lien, created_at, lu')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifs(data)
  }, [supabase])

  useEffect(() => { loadNotifs() }, [loadNotifs])
  // Refresh on route change
  useEffect(() => { loadNotifs() }, [pathname, loadNotifs])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setTab('menu')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.lu).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ lu: true }).in('id', unreadIds)
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

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
      {/* Avatar button with badge */}
      <button
        onClick={() => { setOpen(o => !o); setTab('menu') }}
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
        {/* Notification badge */}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, borderRadius: 9,
            background: '#ef4444', color: 'white',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid white',
            lineHeight: 1, zIndex: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid var(--abed-border)',
          borderRadius: 12, width: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{userName}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</div>
          </div>

          {/* Sub-tabs: Profil / Notifications */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--abed-border)' }}>
            <button
              onClick={() => setTab('menu')}
              style={{
                flex: 1, padding: '9px 0', fontSize: 12, fontWeight: tab === 'menu' ? 700 : 500,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === 'menu' ? 'var(--abed-green)' : '#6b7280',
                borderBottom: tab === 'menu' ? '2px solid var(--abed-green)' : '2px solid transparent',
              }}
            >
              {tc('profile')}
            </button>
            <button
              onClick={() => { setTab('notifs'); markAllRead() }}
              style={{
                flex: 1, padding: '9px 0', fontSize: 12, fontWeight: tab === 'notifs' ? 700 : 500,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === 'notifs' ? 'var(--abed-green)' : '#6b7280',
                borderBottom: tab === 'notifs' ? '2px solid var(--abed-green)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              Notifications
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
                  {unread}
                </span>
              )}
            </button>
          </div>

          {/* Menu tab */}
          {tab === 'menu' && (
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
          )}

          {/* Notifications tab */}
          {tab === 'notifs' && (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  {tc('noData')}
                </div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f3f4f6',
                      background: n.lu ? 'white' : '#eff6ff',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.4 }}>
                      {!n.lu && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', marginRight: 6, verticalAlign: 'middle' }} />}
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmtDate(n.created_at)}</span>
                      {n.lien && (
                        <Link
                          href={n.lien}
                          onClick={() => { markRead(n.id); setOpen(false) }}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--abed-green)', textDecoration: 'none' }}
                        >
                          Ouvrir →
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
