'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ScrollText, ExternalLink, Zap, Users2, CalendarRange } from 'lucide-react'
import { describeLogEntry } from '@/lib/audit-log-labels'

type Profile = { id: string; nom: string; prenoms: string; email: string; role: string }
type LogRow = {
  id: string; actor_id: string | null; actor_nom: string | null; actor_prenoms: string | null
  actor_role: string | null; method: string; path: string; ip: string | null; created_at: string
}
type Stats = {
  todayCount: number; activeToday: number; weekCount: number
  recentUsers: { actor_id: string; actor_nom: string; actor_prenoms: string; actor_role: string; method: string; path: string; created_at: string }[]
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const TONE_COLORS: Record<string, { fg: string; bg: string }> = {
  read: { fg: '#374151', bg: '#f3f4f6' },
  write: { fg: '#166534', bg: '#f0fdf4' },
  danger: { fg: '#991b1b', bg: '#fef2f2' },
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

export default function JournalClient({ users }: { users: Profile[] }) {
  const [actorId, setActorId] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<LogRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (actorId) params.set('actor_id', actorId)
    if (q.trim()) params.set('q', q.trim())
    if (from) params.set('from', new Date(from).toISOString())
    if (to) params.set('to', new Date(to + 'T23:59:59').toISOString())
    const res = await fetch(`/api/admin/journal?${params}`)
    if (res.ok) {
      const j = await res.json()
      setRows(j.data ?? [])
      setCount(j.count ?? 0)
    }
    setLoading(false)
  }, [actorId, q, from, to, page])

  useEffect(() => { load() }, [load])
  // Réinitialise à la première page à chaque changement de filtre.
  useEffect(() => { setPage(0) }, [actorId, q, from, to])

  useEffect(() => {
    fetch('/api/admin/journal/stats').then(r => r.ok ? r.json() : null).then(j => { if (j) setStats(j) })
  }, [])

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText size={22} /> Journal d&apos;audit
        </h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Historique de toutes les requêtes des utilisateurs connectés (navigation et actions). Accès réservé au superadmin.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--abed-green)', lineHeight: 1.1 }}>{stats ? stats.todayCount.toLocaleString('fr-FR') : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Actions aujourd&apos;hui</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users2 size={18} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', lineHeight: 1.1 }}>{stats ? stats.activeToday.toLocaleString('fr-FR') : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Utilisateurs actifs aujourd&apos;hui</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarRange size={18} color="#b45309" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', lineHeight: 1.1 }}>{stats ? stats.weekCount.toLocaleString('fr-FR') : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Actions cette semaine</div>
          </div>
        </div>
      </div>

      {stats && stats.recentUsers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--abed-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Dernière activité par utilisateur
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.recentUsers.map(u => {
              const desc = describeLogEntry(u.method, u.path)
              return (
                <div key={u.actor_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <desc.Icon size={15} color="#6b7280" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{u.actor_prenoms} {u.actor_nom}</span>
                  <span style={{ fontSize: 10, color: 'var(--abed-muted)' }}>({u.actor_role})</span>
                  <span style={{ color: '#6b7280', flex: 1 }}>{desc.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--abed-muted)', whiteSpace: 'nowrap' }}>{timeAgo(u.created_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className="field">
          <label className="label">Utilisateur</label>
          <select className="select" style={{ width: '100%' }} value={actorId} onChange={e => setActorId(e.target.value)}>
            <option value="">— Tous —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.prenoms} {u.nom} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Chemin contient</label>
          <input style={inputStyle} placeholder="/tdr, /conges..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Du</label>
          <input type="date" style={inputStyle} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Au</label>
          <input type="date" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>Date / heure</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>Utilisateur</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>Action</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const desc = describeLogEntry(r.method, r.path)
                const tone = TONE_COLORS[desc.tone]
                return (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 12.5 }}>
                    {r.actor_id ? (
                      <>
                        {r.actor_prenoms} {r.actor_nom}
                        <span style={{ fontSize: 10, color: 'var(--abed-muted)', marginLeft: 6 }}>({r.actor_role})</span>
                      </>
                    ) : <span style={{ color: 'var(--abed-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 7, background: tone.bg, flexShrink: 0,
                      }}>
                        <desc.Icon size={13} color={tone.fg} />
                      </span>
                      <span style={{ fontSize: 13, color: tone.fg, fontWeight: 500 }}>{desc.label}</span>
                    </div>
                    <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: '#9ca3af', marginTop: 2, marginLeft: 32 }}>
                      {r.method} {r.path}
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--abed-muted)' }}>{r.ip ?? '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.actor_id && (
                      <Link href={`/admin/journal/${r.actor_id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--abed-green)', fontWeight: 600 }}>
                        Dossier <ExternalLink size={12} />
                      </Link>
                    )}
                  </td>
                </tr>
                )
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--abed-muted)' }}>Aucune entrée pour ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{count.toLocaleString('fr-FR')} entrée{count > 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn secondary" style={{ fontSize: 12, padding: '6px 14px' }} disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>← Précédent</button>
          <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Page {page + 1} / {totalPages}</span>
          <button className="btn secondary" style={{ fontSize: 12, padding: '6px 14px' }} disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Suivant →</button>
        </div>
      </div>
    </div>
  )
}
