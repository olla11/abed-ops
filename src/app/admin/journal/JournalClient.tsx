'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ScrollText, ExternalLink } from 'lucide-react'

type Profile = { id: string; nom: string; prenoms: string; email: string; role: string }
type LogRow = {
  id: string; actor_id: string | null; actor_nom: string | null; actor_prenoms: string | null
  actor_role: string | null; method: string; path: string; ip: string | null; created_at: string
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#2563eb', POST: '#16a34a', PATCH: '#d97706', PUT: '#d97706', DELETE: '#dc2626',
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
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>Méthode</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>Chemin</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
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
                  <td style={{ padding: '9px 14px', fontSize: 11.5, fontWeight: 700, color: METHOD_COLORS[r.method] ?? '#6b7280' }}>{r.method}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12.5, fontFamily: 'monospace', color: '#374151' }}>{r.path}</td>
                  <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--abed-muted)' }}>{r.ip ?? '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.actor_id && (
                      <Link href={`/admin/journal/${r.actor_id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--abed-green)', fontWeight: 600 }}>
                        Dossier <ExternalLink size={12} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--abed-muted)' }}>Aucune entrée pour ces filtres.</td></tr>
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
