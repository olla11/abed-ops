'use client'
import { useState } from 'react'
import { BookOpen, BarChart3, Link2, Mail, ExternalLink, Pencil, Trash2, Check, Plus } from 'lucide-react'
import type { Ressource } from './page'

type Categorie = Ressource['categorie']

const TABS: { key: Categorie; label: string; Icon: typeof BookOpen; empty: string }[] = [
  { key: 'guide', label: 'Guide', Icon: BookOpen, empty: "Aucun guide pour l'instant." },
  { key: 'rapport', label: 'Rapports', Icon: BarChart3, empty: 'Aucun rapport pour le moment.' },
  { key: 'lien_usuel', label: 'Liens usuels', Icon: Link2, empty: 'Aucun lien pour le moment.' },
]

const CATEGORY_ICON: Record<Categorie, typeof BookOpen> = {
  guide: BookOpen,
  rapport: BarChart3,
  lien_usuel: Link2,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }

function isMail(url: string) { return url.startsWith('mailto:') }

function ResourceCard({
  r, isManager, onEdit, onDeleted,
}: {
  r: Ressource
  isManager: boolean
  onEdit: (r: Ressource) => void
  onDeleted: (id: string) => void
}) {
  const [armed, setArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const mail = isMail(r.url)
  const CardIcon = mail ? Mail : CATEGORY_ICON[r.categorie]

  async function confirmDelete() {
    setDeleting(true)
    const res = await fetch(`/api/ressources/${r.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onDeleted(r.id)
    else setArmed(false)
  }

  return (
    <div style={{
      background: 'white', border: '1px solid var(--abed-border)', borderRadius: 12,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,.03)', transition: 'box-shadow .15s, transform .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: mail ? '#eff6ff' : '#f0fdf4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CardIcon size={19} color={mail ? '#2563eb' : 'var(--abed-green)'} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{r.titre}</div>
          {r.description && <div style={{ fontSize: 12.5, color: '#6b7280' }}>{r.description}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <a href={r.url} target="_blank" rel="noreferrer"
          style={{
            flex: 1, textAlign: 'center', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          {mail ? <Mail size={14} /> : <ExternalLink size={14} />}
          {mail ? 'Écrire' : 'Ouvrir'}
        </a>
        {isManager && (
          <>
            <button onClick={() => onEdit(r)} title="Modifier"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#374151' }}>
              <Pencil size={14} />
            </button>
            {armed ? (
              <button onClick={confirmDelete} disabled={deleting} title="Confirmer la suppression"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: deleting ? 'not-allowed' : 'pointer', background: '#dc2626', border: 'none', color: 'white', opacity: deleting ? 0.7 : 1 }}>
                <Check size={14} />
              </button>
            ) : (
              <button onClick={() => setArmed(true)} title="Supprimer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#dc2626' }}>
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RessourceFormModal({
  categorie, initial, onClose, onSaved,
}: {
  categorie: Categorie
  initial: Ressource | null
  onClose: () => void
  onSaved: (r: Ressource) => void
}) {
  const [titre, setTitre] = useState(initial?.titre ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!titre.trim() || !url.trim()) { setErr('Titre et lien sont requis.'); return }
    setSaving(true); setErr(null)
    const isEdit = !!initial
    const res = await fetch(isEdit ? `/api/ressources/${initial!.id}` : '/api/ressources', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categorie, titre: titre.trim(), url: url.trim(), description: description.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      onSaved(data.ressource)
    } else {
      const data = await res.json().catch(() => ({}))
      setErr(data.error ?? 'Erreur')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460 }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>{initial ? 'Modifier le lien' : 'Ajouter un lien'}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Titre *</label>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Guide de la timesheet" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Lien (http(s):// ou mailto:) *</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Description (optionnel)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RessourcesClient({ ressources: initial, isManager }: { ressources: Ressource[]; isManager: boolean }) {
  const [ressources, setRessources] = useState(initial)
  const [activeTab, setActiveTab] = useState<Categorie>('guide')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Ressource | null>(null)

  const items = ressources.filter(r => r.categorie === activeTab)
  const activeMeta = TABS.find(t => t.key === activeTab)!

  function handleSaved(r: Ressource) {
    setRessources(prev => {
      const exists = prev.some(p => p.id === r.id)
      return exists ? prev.map(p => (p.id === r.id ? r : p)) : [...prev, r]
    })
    setShowForm(false)
    setEditing(null)
  }

  function handleDeleted(id: string) {
    setRessources(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Ressources</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Guides, rapports types et liens utiles de l&apos;organisation.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'var(--abed-green)', color: 'white', border: 'none', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={15} /> Ajouter un lien
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, margin: '20px 0', background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '9px 20px', fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer', border: 'none', borderRadius: 8,
              background: activeTab === t.key ? 'var(--abed-green)' : 'transparent',
              color: activeTab === t.key ? 'white' : '#374151',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <t.Icon size={16} /> {t.label}
            {ressources.filter(r => r.categorie === t.key).length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                background: activeTab === t.key ? 'rgba(255,255,255,.25)' : '#e5e7eb',
                color: activeTab === t.key ? 'white' : '#6b7280',
              }}>
                {ressources.filter(r => r.categorie === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          <activeMeta.Icon size={32} style={{ marginBottom: 10 }} />
          <div>{activeMeta.empty}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {items.map(r => (
            <ResourceCard key={r.id} r={r} isManager={isManager}
              onEdit={rr => { setEditing(rr); setShowForm(true) }}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {showForm && (
        <RessourceFormModal
          categorie={activeTab}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
