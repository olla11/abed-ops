'use client'
import { useState, useMemo, useEffect } from 'react'
import { TYPE_EMPLOI_LABELS } from '@/lib/roles'
import { NOTIFICATION_TOPICS } from '@/lib/notification-topics'
import Pagination, { paginate } from '@/components/Pagination'

const PAGE_SIZE = 10

type User = {
  id: string; civilite?: string; nom: string; prenoms: string
  email: string; role?: string; type_emploi?: string; fonction?: string; manager_id?: string
  notification_topics?: string[]
}

type Announcement = {
  id: string; sujet: string; canaux: string[]; destinataires_count: number
  created_at: string; profiles?: { nom: string; prenoms: string } | null
}

const ROLES = [
  { value: '', label: '— Tous les rôles —' },
  { value: 'missionnaire', label: 'Missionnaire' },
  { value: 'manager', label: 'Manager' },
  { value: 'rh', label: 'RH' },
  { value: 'caf', label: 'CAF' },
  { value: 'aaf', label: 'AAF' },
  { value: 'de', label: 'DE' },
  { value: 'dp', label: 'DP' },
  { value: 'administrateur', label: 'Administrateur' },
  { value: 'admin', label: 'Admin système' },
  { value: 'prestataire', label: 'Prestataire' },
]

const TYPE_OPTIONS = [
  { value: '', label: '— Tous les types —' },
  ...Object.entries(TYPE_EMPLOI_LABELS).map(([v, l]) => ({ value: v, label: l })),
]

export default function ActionsClient({
  users, managers, currentRole,
}: {
  users: User[]
  managers: User[]
  currentRole: string
}) {
  // ── Filtres ──
  const [filterRole, setFilterRole] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [page, setPage] = useState(1)

  // ── Sélection ──
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── Email / communication ciblée ──
  const [showEmail, setShowEmail] = useState(false)
  const [sujet, setSujet] = useState('')
  const [corps, setCorps] = useState('')
  const [canalEmail, setCanalEmail] = useState(true)
  const [canalNotif, setCanalNotif] = useState(true)
  const [sending, setSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ sent: number; total: number; failed: { email: string }[] } | null>(null)

  // ── Historique des communications ──
  const [history, setHistory] = useState<Announcement[] | null>(null)

  useEffect(() => {
    fetch('/api/admin/announcements').then(r => r.ok ? r.json() : null).then(j => { if (j) setHistory(j.data) })
  }, [])

  const filtered = useMemo(() => users.filter(u => {
    if (filterRole && u.role !== filterRole) return false
    if (filterType && u.type_emploi !== filterType) return false
    if (filterManager && u.manager_id !== filterManager) return false
    if (filterTopic && !(u.notification_topics ?? []).includes(filterTopic)) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      const full = `${u.prenoms} ${u.nom} ${u.email}`.toLowerCase()
      if (!full.includes(q)) return false
    }
    return true
  }), [users, filterRole, filterType, filterManager, filterTopic, filterSearch])

  function toggleAll() {
    if (filtered.every(u => selected.has(u.id))) {
      setSelected(s => { const n = new Set(s); filtered.forEach(u => n.delete(u.id)); return n })
    } else {
      setSelected(s => { const n = new Set(s); filtered.forEach(u => n.add(u.id)); return n })
    }
  }

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function resetFilters() {
    setFilterRole(''); setFilterType(''); setFilterManager(''); setFilterTopic(''); setFilterSearch(''); setPage(1)
  }

  async function sendEmail() {
    if (!sujet.trim() || !corps.trim()) { alert('Sujet et corps requis.'); return }
    if (!canalEmail && !canalNotif) { alert('Choisissez au moins un canal d’envoi.'); return }
    setSending(true); setEmailResult(null)
    const canaux = [canalEmail && 'email', canalNotif && 'notification'].filter(Boolean) as string[]
    const res = await fetch('/api/admin/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [...selected], sujet, corps, canaux }),
    })
    const json = await res.json()
    setSending(false)
    if (res.ok) {
      setEmailResult(json)
      fetch('/api/admin/announcements').then(r => r.ok ? r.json() : null).then(j => { if (j) setHistory(j.data) })
    }
    else alert('Erreur : ' + json.error)
  }

  const paged = paginate(filtered, page, PAGE_SIZE)
  const allFilteredSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))
  const someSelected = selected.size > 0

  function exportExcel() {
    const BOM = '﻿'
    const headers = ['Civilité', 'Nom', 'Prénoms', 'Email', 'Rôle', "Type d'emploi", 'Fonction']
    const rows = users.map(u => [
      u.civilite ?? '',
      u.nom,
      u.prenoms,
      u.email,
      u.role ?? '',
      u.type_emploi ? ((TYPE_EMPLOI_LABELS as Record<string, string>)[u.type_emploi] ?? u.type_emploi) : '',
      u.fonction ?? '',
    ])
    const csv = BOM + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `utilisateurs_abed_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container" style={{ display: 'grid', gap: 20 }}>

      {/* ── Filtres ── */}
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 14 }}>🔍 Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="field">
            <label className="label">Recherche</label>
            <input className="input" placeholder="Nom, prénom, email…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Rôle système</label>
            <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Type d'emploi</label>
            <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
              {TYPE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Responsable direct</label>
            <select className="input" value={filterManager} onChange={e => setFilterManager(e.target.value)}>
              <option value="">— Tous —</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.prenoms} {m.nom}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Sujet d&apos;intérêt (opt-in)</label>
            <select className="input" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
              <option value="">— Tous —</option>
              {NOTIFICATION_TOPICS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button className="btn secondary" style={{ fontSize: 12 }} onClick={resetFilters}>
            ✕ Réinitialiser les filtres
          </button>
          <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
            {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''} correspondant{filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Export Excel ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn secondary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={exportExcel}>
          📊 Exporter tous les utilisateurs (.csv / Excel)
        </button>
      </div>

      {/* ── Barre d'actions ── */}
      {someSelected && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--abed-green)', fontSize: 14 }}>
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <button className="btn" style={{ fontSize: 13 }} onClick={() => { setShowEmail(true); setEmailResult(null) }}>
            ✉️ Communication ciblée
          </button>
          <button className="btn secondary" style={{ fontSize: 13 }}
            onClick={() => setSelected(new Set())}>
            Tout désélectionner
          </button>
        </div>
      )}

      {/* ── Modal email ── */}
      {showEmail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, margin: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>✉️ Communication ciblée — {selected.size} destinataire{selected.size > 1 ? 's' : ''}</h3>
              <button onClick={() => setShowEmail(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label className="label">Canaux d&apos;envoi</label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={canalEmail} onChange={e => setCanalEmail(e.target.checked)} /> Email
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={canalNotif} onChange={e => setCanalNotif(e.target.checked)} /> Notification dans l&apos;appli
                </label>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Vous pouvez utiliser <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4 }}>{'{prenom}'}</code>,{' '}
              <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4 }}>{'{nom}'}</code> et{' '}
              <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4 }}>{'{email}'}</code> dans le corps pour personnaliser le message.
            </p>

            <div className="field" style={{ marginBottom: 14 }}>
              <label className="label">Sujet *</label>
              <input className="input" value={sujet} onChange={e => setSujet(e.target.value)}
                placeholder="Ex : Rappel — Soumission timesheet juin 2026" />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label className="label">Corps du message *</label>
              <textarea className="input" rows={8} value={corps} onChange={e => setCorps(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                placeholder={'Bonjour {prenom},\n\nNous vous rappelons de soumettre votre timesheet du mois en cours.\n\nCordialement,\nL\'équipe ABED'} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 6 }}>Destinataires :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...selected].slice(0, 12).map(id => {
                  const u = users.find(x => x.id === id)
                  return u ? (
                    <span key={id} style={{
                      fontSize: 11, background: '#e0f2fe', color: '#0369a1',
                      padding: '2px 8px', borderRadius: 999,
                    }}>{u.prenoms} {u.nom}</span>
                  ) : null
                })}
                {selected.size > 12 && (
                  <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>+{selected.size - 12} autres</span>
                )}
              </div>
            </div>

            {emailResult && (
              <div style={{
                marginBottom: 14, padding: '10px 14px', borderRadius: 8,
                background: emailResult.failed.length ? '#fef9c3' : '#dcfce7',
                color: emailResult.failed.length ? '#92660b' : '#166534',
                fontSize: 13,
              }}>
                ✓ {emailResult.sent} email{emailResult.sent > 1 ? 's' : ''} envoyé{emailResult.sent > 1 ? 's' : ''} sur {emailResult.total}.
                {emailResult.failed.length > 0 && (
                  <span> Échecs : {emailResult.failed.map(f => f.email).join(', ')}</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={sendEmail} disabled={sending}>
                {sending ? '⏳ Envoi…' : `✉️ Envoyer à ${selected.size} personne${selected.size > 1 ? 's' : ''}`}
              </button>
              <button className="btn secondary" onClick={() => setShowEmail(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tableau utilisateurs ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Utilisateurs</h3>
          {filtered.length > 0 && (
            <button className="btn secondary" style={{ fontSize: 12 }} onClick={toggleAll}>
              {allFilteredSelected ? 'Désélectionner cette page' : 'Sélectionner cette page'}
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allFilteredSelected}
                    onChange={toggleAll} title="Tout sélectionner" />
                </th>
                <th>Nom &amp; Prénoms</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Type d'emploi</th>
                <th>Fonction</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(u => (
                <tr key={u.id}
                  onClick={() => toggle(u.id)}
                  style={{ cursor: 'pointer', background: selected.has(u.id) ? '#f0fdf4' : undefined }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{u.prenoms} {u.nom}</td>
                  <td style={{ fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                    {u.type_emploi ? (TYPE_EMPLOI_LABELS as any)[u.type_emploi] ?? u.type_emploi : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>{u.fonction ?? '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--abed-muted)', textAlign: 'center' }}>
                  Aucun utilisateur ne correspond aux filtres.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={p => { setPage(p); setSelected(new Set()) }} />
      </div>

      {/* ── Historique des communications ── */}
      {history && history.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Historique des communications ciblées</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{a.sujet}</span>
                {a.profiles && (
                  <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>par {a.profiles.prenoms} {a.profiles.nom}</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                  {a.canaux.includes('email') && 'Email'}{a.canaux.includes('email') && a.canaux.includes('notification') && ' + '}{a.canaux.includes('notification') && 'Notification'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>{a.destinataires_count} destinataire{a.destinataires_count > 1 ? 's' : ''}</span>
                <span style={{ fontSize: 11, color: 'var(--abed-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
