'use client'
import { useEffect, useState } from 'react'

function AgaReindexSection() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ files: string[]; totalChunks: number; failedChunks: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reindex() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/aga/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Erreur')
      else setResult(data)
    } catch {
      setError('Erreur réseau')
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4, fontSize: 15 }}>Assistant AGA — Base de connaissances</h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Reconstruit l'index de recherche (RAG) à partir des fichiers du dossier knowledge/. À relancer après
        chaque ajout ou modification de document, pour que les réponses d'AGA en tiennent compte.
      </p>
      <button className="btn" style={{ fontSize: 13 }} disabled={loading} onClick={reindex}>
        {loading ? '⏳ Réindexation…' : '🔄 Réindexer la base de connaissances'}
      </button>
      {error && <p style={{ fontSize: 13, color: '#991b1b', marginTop: 8 }}>Erreur : {error}</p>}
      {result && (
        <p style={{ fontSize: 13, color: '#166534', marginTop: 8 }}>
          ✓ {result.files.length} fichier(s) indexé(s) ({result.totalChunks} passages
          {result.failedChunks > 0 ? `, ${result.failedChunks} échec(s)` : ''}) : {result.files.join(', ')}
        </p>
      )}
    </div>
  )
}

type StorageInfo = {
  totalBytes: number; quotaBytes: number
  details: Record<string, number>
  counts: { missions: number; soumissions: number; profiles: number; payments: number }
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`
}

const DELETE_TYPES = [
  { key: 'missions', label: 'Missions', desc: 'clôturées ou rejetées' },
  { key: 'soumissions', label: 'Timesheets/soumissions', desc: 'validés ou rejetés définitivement' },
  { key: 'payments', label: 'Paiements', desc: 'réussis, échoués ou annulés' },
  { key: 'notifications', label: 'Notifications', desc: 'lues' },
]

export default function AdminStorage() {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [dates, setDates] = useState<Record<string, string>>({})
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/storage')
    if (res.ok) setInfo(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function bulkDelete(type: string) {
    const month = dates[type] // format YYYY-MM
    if (!month) { setMsgs(m => ({ ...m, [type]: 'Choisissez un mois.' })); return }
    // Calcule le premier jour du mois suivant → supprime tout créé AVANT cette date
    const [yyyy, mm] = month.split('-').map(Number)
    const nextMonth = new Date(yyyy, mm, 1) // mois suivant, jour 1
    const before = nextMonth.toISOString().split('T')[0]
    const label = DELETE_TYPES.find(t => t.key === type)?.label.toLowerCase()
    const desc = DELETE_TYPES.find(t => t.key === type)?.desc
    const monthFr = new Date(yyyy, mm - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!confirm(`Supprimer les ${label} (${desc}) jusqu'à fin ${monthFr} inclus ?`)) return

    setDeleting(type)
    const res = await fetch(`/api/admin/bulk-delete?type=${type}&before=${before}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(null)
    if (res.ok) {
      setMsgs(m => ({ ...m, [type]: `✓ ${data.deleted} élément(s) supprimé(s).` }))
      load()
    } else {
      setMsgs(m => ({ ...m, [type]: 'Erreur : ' + data.error }))
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement du stockage…</p>
  if (!info) return null

  const pct = Math.min(100, (info.totalBytes / info.quotaBytes) * 100)
  const barColor = pct > 80 ? '#c0392b' : pct > 60 ? '#d97706' : '#63a521'

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Barre de stockage */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>Espace de stockage</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span>Utilisé : <strong>{fmtSize(info.totalBytes)}</strong></span>
          <span>Quota : <strong>{fmtSize(info.quotaBytes)}</strong></span>
          <span style={{ color: barColor, fontWeight: 700 }}>{pct.toFixed(1)} %</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 999, height: 14, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: barColor, height: '100%', borderRadius: 999, transition: 'width .3s' }} />
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--abed-muted)' }}>
          {Object.entries(info.details).map(([bucket, bytes]) => (
            <span key={bucket}>{bucket} : {fmtSize(bytes)}</span>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--abed-muted)' }}>
          <span>Missions : {info.counts.missions}</span>
          <span>Soumissions : {info.counts.soumissions}</span>
          <span>Utilisateurs : {info.counts.profiles}</span>
          <span>Paiements : {info.counts.payments}</span>
        </div>
      </div>

      {/* Suppression par type et date */}
      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 15 }}>Suppression par lot</h3>
        <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
          Sélectionne un mois pour supprimer les éléments terminés/lus jusqu'à la fin de ce mois. Irréversible.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {DELETE_TYPES.map(t => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 14px', background: 'var(--abed-bg)', borderRadius: 8 }}>
              <div style={{ flex: '1 1 200px' }}>
                <strong style={{ fontSize: 13 }}>{t.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--abed-muted)', marginLeft: 6 }}>({t.desc})</span>
              </div>
              <input type="month" style={{ padding: '6px 10px', border: '1px solid var(--abed-border)', borderRadius: 6, fontSize: 13 }}
                value={dates[t.key] ?? ''}
                onChange={e => setDates(d => ({ ...d, [t.key]: e.target.value }))} />
              <button className="btn danger" style={{ fontSize: 12, padding: '6px 14px' }}
                disabled={deleting === t.key}
                onClick={() => bulkDelete(t.key)}>
                {deleting === t.key ? '⏳…' : 'Supprimer'}
              </button>
              {msgs[t.key] && (
                <span style={{ fontSize: 12, color: msgs[t.key].startsWith('✓') ? '#166534' : '#991b1b' }}>
                  {msgs[t.key]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <AgaReindexSection />
    </div>
  )
}
