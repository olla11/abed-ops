'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Activite = { id: string; statut: string }
type Projet = {
  id: string; nom: string; description: string | null; statut: string
  date_debut: string | null; date_fin: string | null; created_at: string
  created_by: string; is_public: boolean
  created_by_profile: { nom: string; prenoms: string } | null
  activites: Activite[]
}

const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifié', en_cours: 'En cours', en_pause: 'En pause', termine: 'Terminé', annule: 'Annulé',
}
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  planifie:  { bg: '#dbeafe', color: '#1e40af' },
  en_cours:  { bg: '#dcfce7', color: '#166534' },
  en_pause:  { bg: '#fef3c7', color: '#92400e' },
  termine:   { bg: '#f3f4f6', color: '#374151' },
  annule:    { bg: '#fee2e2', color: '#991b1b' },
}

function ProjetCard({ projet, onClick }: { projet: Projet; onClick: () => void }) {
  const total = projet.activites.length
  const done = projet.activites.filter(a => a.statut === 'termine').length
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const sc = STATUT_COLORS[projet.statut] ?? STATUT_COLORS.en_cours
  const creator = projet.created_by_profile
    ? `${projet.created_by_profile.prenoms} ${projet.created_by_profile.nom}` : '—'

  const statusCounts = ['a_faire', 'en_cours', 'en_revue', 'termine'].map(s => ({
    s, count: projet.activites.filter(a => a.statut === s).length,
    label: { a_faire: 'À faire', en_cours: 'En cours', en_revue: 'En revue', termine: 'Terminé' }[s] ?? s,
    color: { a_faire: '#6b7280', en_cours: '#2563eb', en_revue: '#7c3aed', termine: '#16a34a' }[s] ?? '#6b7280',
  }))

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 16,
        padding: 24, cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = 'var(--abed-green)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#e5e7eb' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827', flex: 1, paddingRight: 12 }}>{projet.nom}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!projet.is_public && (
            <span title="Projet privé" style={{ fontSize: 13 }}>🔒</span>
          )}
          <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
            {STATUT_LABELS[projet.statut]}
          </span>
        </div>
      </div>

      {projet.description && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {projet.description}
        </p>
      )}

      {/* Barre de progression */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, color: '#6b7280' }}>
          <span>{done}/{total} tâches terminées</span>
          <span style={{ fontWeight: 700, color: pct === 100 ? '#16a34a' : '#374151' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 999 }}>
          <div style={{ height: 6, borderRadius: 999, background: pct === 100 ? '#16a34a' : 'var(--abed-green)', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Compteurs par statut */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {statusCounts.filter(s => s.count > 0).map(s => (
          <span key={s.s} style={{ fontSize: 11, color: s.color, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 999, padding: '2px 8px' }}>
            {s.label}: {s.count}
          </span>
        ))}
        {total === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Aucune tâche</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#9ca3af' }}>
        <span>Par {creator}</span>
        <span>{new Date(projet.created_at).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  )
}

export default function ProjetsClient({ projets: initial, userId }: { projets: Projet[]; userId: string }) {
  const router = useRouter()
  const [projets, setProjets] = useState<Projet[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nom: '', description: '', statut: 'en_cours', date_debut: '', date_fin: '', is_public: true })
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  async function createProjet() {
    if (!form.nom.trim()) { setErr('Nom requis'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/projets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error); setSaving(false); return }
    router.push(`/projets/${j.data.id}`)
  }

  const filtered = projets.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.nom.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    const matchStatut = !filterStatut || p.statut === filterStatut
    return matchSearch && matchStatut
  })

  return (
    <div className="page-container">
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>Projets</h1>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>{projets.length} projet{projets.length > 1 ? 's' : ''} au total</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)} style={{ fontSize: 13 }}>+ Nouveau projet</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          placeholder="Rechercher un projet…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, outline: 'none', minWidth: 240 }}
        />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--abed-border)', fontSize: 13, outline: 'none', background: 'white' }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Formulaire nouveau projet */}
      {showForm && (
        <div style={{ background: '#f0fdf4', border: '2px solid var(--abed-green)', borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--abed-green)', fontSize: 16 }}>Nouveau projet</h3>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Nom du projet *</label>
              <input className="input" placeholder="Ex: Campagne de sensibilisation Q3"
                value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Description</label>
              <textarea className="input" rows={3} placeholder="Décrivez l'objectif du projet…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="select" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="label">Date début</label>
                <input className="input" type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div>
                <label className="label">Date fin</label>
                <input className="input" type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Visibilité</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_public: true }))}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${form.is_public ? 'var(--abed-green)' : '#e5e7eb'}`,
                    background: form.is_public ? '#f0fdf4' : 'white', cursor: 'pointer',
                    color: form.is_public ? '#166534' : '#6b7280', fontWeight: form.is_public ? 700 : 400, fontSize: 13,
                  }}>
                  🌐 Public — visible par tous
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_public: false }))}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${!form.is_public ? '#7c3aed' : '#e5e7eb'}`,
                    background: !form.is_public ? '#f5f3ff' : 'white', cursor: 'pointer',
                    color: !form.is_public ? '#5b21b6' : '#6b7280', fontWeight: !form.is_public ? 700 : 400, fontSize: 13,
                  }}>
                  🔒 Privé — invités uniquement
                </button>
              </div>
              {!form.is_public && (
                <p style={{ fontSize: 12, color: '#7c3aed', margin: '6px 0 0' }}>
                  Seuls le créateur et les membres ayant des tâches assignées pourront voir ce projet.
                </p>
              )}
            </div>
          </div>
          {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={createProjet} disabled={saving}>{saving ? 'Création…' : 'Créer le projet'}</button>
            <button className="btn secondary" onClick={() => { setShowForm(false); setErr('') }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Grille de projets */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--abed-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Aucun projet trouvé</p>
          <p style={{ fontSize: 13 }}>{search || filterStatut ? 'Modifiez vos filtres.' : 'Créez votre premier projet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {filtered.map(p => (
            <ProjetCard key={p.id} projet={p} onClick={() => router.push(`/projets/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
