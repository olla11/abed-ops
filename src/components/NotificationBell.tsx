'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { usePathname } from 'next/navigation'

type Notif = {
  id: string
  titre: string | null
  message: string
  lien: string | null
  created_at: string
  lu: boolean
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, titre, message, lien, created_at, lu')
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifs(data)
  }, [supabase])

  useEffect(() => { load() }, [load])
  useEffect(() => { load() }, [pathname, load])

  // Realtime : écouter les nouveaux INSERT
  useEffect(() => {
    const channel = supabase
      .channel('notifs-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter(n => !n.lu).length

  async function deleteNotif(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    const ids = notifs.map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').delete().in('id', ids)
    setNotifs([])
  }

  function fmtDate(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (diff < 1) return "à l'instant"
    if (diff < 60) return `il y a ${diff} min`
    const diffH = Math.floor(diff / 60)
    if (diffH < 24) return `il y a ${diffH}h`
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Cloche */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative', width: 38, height: 38, borderRadius: '50%',
          background: open ? '#f0fdf4' : 'transparent',
          border: '1px solid ' + (open ? 'var(--abed-green)' : 'var(--abed-border)'),
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, transition: 'background .15s, border-color .15s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={open ? 'var(--abed-green)' : '#374151'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 17, height: 17, borderRadius: 9,
            background: '#ef4444', color: 'white',
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid white', lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panneau */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid var(--abed-border)',
          borderRadius: 12, width: 340,
          boxShadow: '0 8px 32px rgba(0,0,0,.14)',
          overflow: 'hidden',
        }}>
          {/* Header panneau */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--abed-border)',
            background: '#f9fafb',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Notifications {unread > 0 && <span style={{ color: '#ef4444' }}>({unread})</span>}
            </span>
            {notifs.length > 0 && (
              <button onClick={deleteAll} style={{
                fontSize: 11, color: '#6b7280', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}>
                Tout effacer
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                Aucune notification
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: '11px 14px',
                    borderBottom: '1px solid #f3f4f6',
                    background: n.lu ? 'white' : '#eff6ff',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    transition: 'background .1s',
                  }}
                >
                  {/* Point non-lu */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: n.lu ? '#d1d5db' : '#3b82f6',
                  }} />

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.titre && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.titre}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, marginBottom: 4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmtDate(n.created_at)}</span>
                      {n.lien && (
                        <Link
                          href={n.lien}
                          onClick={() => { deleteNotif(n.id); setOpen(false) }}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--abed-green)', textDecoration: 'none' }}
                        >
                          Afficher →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Bouton supprimer */}
                  <button
                    onClick={() => deleteNotif(n.id)}
                    title="Supprimer"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', fontSize: 16, lineHeight: 1,
                      padding: '0 2px', flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
