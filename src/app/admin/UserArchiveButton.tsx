'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function UserArchiveButton({
  userId, name, archived,
}: {
  userId: string
  name: string
  archived: boolean
}) {
  const router = useRouter()
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const REASONS = [
    ta('archiveReasons.resignation'),
    ta('archiveReasons.contractEnd'),
    ta('archiveReasons.transfer'),
    ta('archiveReasons.retirement'),
    ta('archiveReasons.other'),
  ]
  const [modal, setModal] = useState<'archive' | 'restore' | 'delete' | null>(null)
  const [reason, setReason] = useState(REASONS[0])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function archive() {
    setLoading(true); setErr('')
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) { setModal(null); router.refresh() }
    else setErr(data.error ?? 'Erreur inconnue')
  }

  async function restore() {
    setLoading(true); setErr('')
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'PUT' })
    const data = await res.json()
    setLoading(false)
    if (data.ok) { setModal(null); router.refresh() }
    else setErr(data.error ?? 'Erreur inconnue')
  }

  async function del() {
    setLoading(true); setErr('')
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)
    if (data.ok) { setModal(null); router.refresh() }
    else setErr(data.error ?? 'Erreur inconnue')
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {archived ? (
          <button
            onClick={() => { setModal('restore'); setErr('') }}
            title="Restaurer ce compte"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <RotateCcw size={13} /> {ta('restore')}
          </button>
        ) : (
          <button
            onClick={() => { setModal('archive'); setErr('') }}
            title={`${ta('archive')} ${name}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <Archive size={13} /> {ta('archive')}
          </button>
        )}
        <button
          onClick={() => { setModal('delete'); setErr('') }}
          title={`Supprimer définitivement ${name}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-danger)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {mounted && modal === 'archive' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#111827' }}>{ta('archive')}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
              <strong>{name}</strong> {ta('archiveWarning')}
            </p>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
              💡 {ta('archiveTip')}
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {ta('archiveReason')}
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, marginBottom: 20 }}
            >
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
            {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" style={{ fontSize: 13 }} onClick={() => setModal(null)}>{tc('cancel')}</button>
              <button
                className="btn"
                style={{ fontSize: 13, background: '#92400e', borderColor: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={loading}
                onClick={archive}
              >
                <Archive size={14} />{loading ? tc('loading') : ta('archive')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && modal === 'restore' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 380, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#111827' }}>{ta('restore')}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
              <strong>{name}</strong> {ta('restoreConfirm')}
            </p>
            {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" style={{ fontSize: 13 }} onClick={() => setModal(null)}>{tc('cancel')}</button>
              <button className="btn" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} disabled={loading} onClick={restore}>
                <RotateCcw size={14} />{loading ? tc('loading') : ta('restore')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && modal === 'delete' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--abed-danger)' }}>{tc('delete')}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>
              <strong>{name}</strong> — {ta('deleteWarning')}
            </p>
            <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, marginBottom: 20 }}>
              ⚠️ {ta('deleteAdvice')}
            </p>
            {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn secondary" style={{ fontSize: 13 }} onClick={() => setModal(null)}>{tc('cancel')}</button>
              <button
                className="btn"
                style={{ fontSize: 13, background: 'var(--abed-danger)', borderColor: 'var(--abed-danger)', display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={loading}
                onClick={del}
              >
                <Trash2 size={14} />{loading ? tc('loading') : tc('delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
