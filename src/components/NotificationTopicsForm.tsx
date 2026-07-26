'use client'
import { useState } from 'react'
import { NOTIFICATION_TOPICS } from '@/lib/notification-topics'

export default function NotificationTopicsForm({ topics }: { topics: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(topics))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function toggle(value: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(value) ? n.delete(value) : n.add(value)
      return n
    })
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/profile/notification-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: [...selected] }),
    })
    setSaving(false)
    setMsg(res.ok ? 'Préférences enregistrées.' : 'Erreur lors de l’enregistrement.')
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Choisissez les sujets sur lesquels vous acceptez de recevoir des communications ciblées de l&apos;administration.
        Entièrement facultatif — vous pouvez décocher un sujet à tout moment, sans impact sur votre accès à l&apos;application.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {NOTIFICATION_TOPICS.map(t => (
          <label key={t.value} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--abed-border)',
            cursor: 'pointer', background: selected.has(t.value) ? '#f0fdf4' : 'transparent',
          }}>
            <input type="checkbox" checked={selected.has(t.value)} onChange={() => toggle(t.value)} />
            {t.label}
          </label>
        ))}
      </div>
      {msg && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14,
          background: msg.startsWith('Erreur') ? '#fee2e2' : '#dcfce7',
          color: msg.startsWith('Erreur') ? '#991b1b' : '#166534',
        }}>{msg}</div>
      )}
      <button className="btn" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer mes préférences'}
      </button>
    </div>
  )
}
