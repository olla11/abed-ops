'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

type Notif = {
  id: string
  titre: string | null
  message: string
  lien: string | null
  created_at: string
  lu: boolean
}

export default function NotificationsClient({ initialNotifs }: { initialNotifs: Notif[] }) {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs)
  const supabase = createClient()

  async function deleteOne(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    const ids = notifs.map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').delete().in('id', ids)
    setNotifs([])
  }

  function fmtDate(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (diff < 1) return "à l'instant"
    if (diff < 60) return `il y a ${diff} min`
    const diffH = Math.floor(diff / 60)
    if (diffH < 24) return `il y a ${diffH}h`
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  if (notifs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
        <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucune notification</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid var(--abed-border)',
        background: '#f9fafb',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
          {notifs.length} notification{notifs.length > 1 ? 's' : ''}
          {notifs.filter(n => !n.lu).length > 0 && (
            <span style={{ marginLeft: 8, background: '#ef4444', color: 'white', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '1px 8px' }}>
              {notifs.filter(n => !n.lu).length} non lue{notifs.filter(n => !n.lu).length > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <button onClick={deleteAll} style={{
          fontSize: 12, color: '#ef4444', background: 'none', border: '1px solid #fecaca',
          borderRadius: 6, cursor: 'pointer', padding: '4px 12px', fontWeight: 600,
        }}>
          Tout supprimer
        </button>
      </div>

      {/* Liste */}
      {notifs.map(n => (
        <div key={n.id} style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
          background: n.lu ? 'white' : '#eff6ff',
        }}>
          {/* Point */}
          <span style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 6,
            background: n.lu ? '#d1d5db' : '#3b82f6',
          }} />

          {/* Contenu */}
          <div style={{ flex: 1 }}>
            {n.titre && (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                {n.titre}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>
              {n.message}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(n.created_at)}</span>
              {n.lien && (
                <Link href={n.lien} onClick={() => deleteOne(n.id)}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--abed-green)', textDecoration: 'none' }}>
                  Voir →
                </Link>
              )}
            </div>
          </div>

          {/* Supprimer */}
          <button onClick={() => deleteOne(n.id)} title="Supprimer"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: '0 4px', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
