'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { id: string; nom: string; prenoms: string }
type Commentaire = { id: string; contenu: string; created_at: string; auteur: { nom: string; prenoms: string } | null }
type Activite = {
  id: string; nom: string; description: string | null; statut: string; priorite: string
  assignee_id: string | null; date_echeance: string | null; created_by: string | null
  assignee: Profile | null
  created_by_profile: Profile | null
  commentaires_activites: { id: string }[]
}
type Projet = {
  id: string; nom: string; description: string | null; statut: string
  date_debut: string | null; date_fin: string | null; created_by: string | null
  created_by_profile: Profile | null
  activites: Activite[]
}

const STATUT_LABELS: Record<string, string> = { planifie: 'Planifié', en_cours: 'En cours', en_pause: 'En pause', termine: 'Terminé', annule: 'Annulé' }
const ACT_STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', en_revue: 'En revue', termine: 'Terminé' }
const PRIO_LABELS: Record<string, string> = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' }
const PRIO_COLORS: Record<string, { bg: string; color: string }> = {
  basse:   { bg: '#f3f4f6', color: '#6b7280' },
  normale: { bg: '#dbeafe', color: '#1e40af' },
  haute:   { bg: '#fef3c7', color: '#92400e' },
  urgente: { bg: '#fee2e2', color: '#991b1b' },
}
const ACT_STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  a_faire:  { bg: '#f3f4f6', color: '#374151' },
  en_cours: { bg: '#dbeafe', color: '#1e40af' },
  en_revue: { bg: '#ede9fe', color: '#5b21b6' },
  termine:  { bg: '#dcfce7', color: '#166534' },
}
const COLUMNS = ['a_faire', 'en_cours', 'en_revue', 'termine'] as const
const COL_COLORS: Record<string, string> = { a_faire: '#6b7280', en_cours: '#2563eb', en_revue: '#7c3aed', termine: '#16a34a' }

function Initials({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  const txt = `${profile.prenoms?.[0] ?? ''}${profile.nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--abed-green)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {txt}
    </div>
  )
}

export default function ProjetDetailClient({ projet: initial, userId, allProfiles }: { projet: Projet; userId: string; allProfiles: Profile[] }) {
  const router = useRouter()
  const [projet, setProjet] = useState<Projet>(initial)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [selectedActivite, setSelectedActivite] = useState<Activite | null>(null)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showNewTaskForm, setShowNewTaskForm] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ nom: '', description: '', priorite: 'normale', assignee_id: '', date_echeance: '', statut: 'a_faire' })
  const [savingTask, setSavingTask] = useState(false)
  const [editingStatut, setEditingStatut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)

  async function openActivite(act: Activite) {
    setSelectedActivite(act)
    setLoadingComments(true)
    const r = await fetch(`/api/commentaires-activites?activite_id=${act.id}`)
    const j = await r.json()
    setCommentaires(j.data ?? [])
    setLoadingComments(false)
  }

  async function addComment() {
    if (!newComment.trim() || !selectedActivite) return
    setSendingComment(true)
    const r = await fetch('/api/commentaires-activites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activite_id: selectedActivite.id, contenu: newComment.trim() }),
    })
    const j = await r.json()
    if (r.ok) { setCommentaires(c => [...c, j.data]); setNewComment('') }
    setSendingComment(false)
  }

  async function patchActivite(activiteId: string, patch: Record<string, string | null>) {
    const r = await fetch(`/api/activites/${activiteId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await r.json()
    if (r.ok) {
      setProjet(p => ({ ...p, activites: p.activites.map(a => a.id === activiteId ? { ...a, ...j.data } : a) }))
      if (selectedActivite?.id === activiteId) setSelectedActivite(prev => prev ? { ...prev, ...j.data } : null)
    }
    setEditingCell(null)
  }

  async function deleteActivite(activiteId: string) {
    if (!confirm('Supprimer cette tâche ?')) return
    await fetch(`/api/activites/${activiteId}`, { method: 'DELETE' })
    setProjet(p => ({ ...p, activites: p.activites.filter(a => a.id !== activiteId) }))
    if (selectedActivite?.id === activiteId) setSelectedActivite(null)
  }

  async function addTask(statut?: string) {
    if (!taskForm.nom.trim()) return
    setSavingTask(true)
    const r = await fetch('/api/activites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...taskForm, projet_id: projet.id, statut: statut ?? taskForm.statut, assignee_id: taskForm.assignee_id || null }),
    })
    const j = await r.json()
    if (r.ok) {
      setProjet(p => ({ ...p, activites: [...p.activites, j.data] }))
      setTaskForm({ nom: '', description: '', priorite: 'normale', assignee_id: '', date_echeance: '', statut: 'a_faire' })
      setShowNewTaskForm(null)
      setShowAddRow(false)
    }
    setSavingTask(false)
  }

  async function deleteProjet() {
    if (!confirm('Supprimer ce projet et toutes ses tâches ?')) return
    setDeleting(true)
    await fetch(`/api/projets/${projet.id}`, { method: 'DELETE' })
    router.push('/projets')
  }

  async function changeProjetStatut(statut: string) {
    const r = await fetch(`/api/projets/${projet.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    if (r.ok) { setProjet(p => ({ ...p, statut })); setEditingStatut(false) }
  }

  const total = projet.activites.length
  const done = projet.activites.filter(a => a.statut === 'termine').length
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const isCreator = projet.created_by === userId

  const projetStatutColors: Record<string, { bg: string; color: string }> = {
    planifie:  { bg: '#dbeafe', color: '#1e40af' },
    en_cours:  { bg: '#dcfce7', color: '#166534' },
    en_pause:  { bg: '#fef3c7', color: '#92400e' },
    termine:   { bg: '#f3f4f6', color: '#374151' },
    annule:    { bg: '#fee2e2', color: '#991b1b' },
  }
  const psc = projetStatutColors[projet.statut] ?? projetStatutColors.en_cours

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px', paddingRight: selectedActivite ? 460 : 20, transition: 'padding-right 0.2s' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push('/projets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12 }}>
          ← Tous les projets
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', margin: 0 }}>{projet.nom}</h1>
              {editingStatut ? (
                <select autoFocus className="select" style={{ fontSize: 12 }}
                  defaultValue={projet.statut} onBlur={e => changeProjetStatut(e.target.value)} onChange={e => changeProjetStatut(e.target.value)}>
                  {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span onClick={() => isCreator && setEditingStatut(true)}
                  title={isCreator ? 'Cliquer pour modifier' : ''}
                  style={{ cursor: isCreator ? 'pointer' : 'default', background: psc.bg, color: psc.color, borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                  {STATUT_LABELS[projet.statut]}
                </span>
              )}
            </div>
            {projet.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 }}>{projet.description}</p>}
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
              <span>Par {projet.created_by_profile ? `${projet.created_by_profile.prenoms} ${projet.created_by_profile.nom}` : '—'}</span>
              {projet.date_debut && <span>Début : {new Date(projet.date_debut).toLocaleDateString('fr-FR')}</span>}
              {projet.date_fin && <span>Fin : {new Date(projet.date_fin).toLocaleDateString('fr-FR')}</span>}
              <span style={{ fontWeight: 700, color: pct === 100 ? '#16a34a' : '#374151' }}>{done}/{total} tâches — {pct}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCreator && (
              <button onClick={deleteProjet} disabled={deleting}
                style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                {deleting ? '…' : '🗑 Supprimer'}
              </button>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ marginTop: 14, height: 5, background: '#f3f4f6', borderRadius: 999 }}>
          <div style={{ height: 5, borderRadius: 999, background: pct === 100 ? '#16a34a' : 'var(--abed-green)', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Toggle vue */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'table', label: '≡ Liste' },
          { key: 'kanban', label: '⬜ Tableau' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key as 'table' | 'kanban')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: 13, fontWeight: view === v.key ? 700 : 500,
              color: view === v.key ? 'var(--abed-green)' : '#6b7280',
              borderBottom: view === v.key ? '2px solid var(--abed-green)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {v.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setShowAddRow(true); setView('table') }} style={{ fontSize: 12, marginBottom: 6 }}>
          + Ajouter une tâche
        </button>
      </div>

      {/* === VUE TABLE === */}
      {view === 'table' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {/* En-têtes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px 110px 40px', gap: 0, background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['Nom', 'Assigné', 'Statut', 'Priorité', 'Échéance', ''].map((h, i) => (
              <div key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', borderRight: i < 5 ? '1px solid #f3f4f6' : 'none' }}>{h}</div>
            ))}
          </div>

          {/* Lignes */}
          {projet.activites.length === 0 && !showAddRow && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Aucune tâche — cliquez sur "+ Ajouter une tâche" pour commencer.
            </div>
          )}

          {projet.activites.map((act, idx) => {
            const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
            const sc = ACT_STATUT_COLORS[act.statut] ?? ACT_STATUT_COLORS.a_faire
            const isSelected = selectedActivite?.id === act.id
            const isOverdue = act.date_echeance && new Date(act.date_echeance) < new Date() && act.statut !== 'termine'
            return (
              <div key={act.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px 110px 40px',
                  borderBottom: '1px solid #f3f4f6',
                  background: isSelected ? '#f0fdf4' : 'white',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white' }}
              >
                {/* Nom */}
                <div onClick={() => openActivite(act)}
                  style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRight: '1px solid #f3f4f6', minWidth: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${COL_COLORS[act.statut]}`, flexShrink: 0, background: act.statut === 'termine' ? COL_COLORS[act.statut] : 'white' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.nom}</span>
                  {(act.commentaires_activites?.length ?? 0) > 0 && (
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>💬 {act.commentaires_activites.length}</span>
                  )}
                </div>

                {/* Assigné */}
                <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'assignee' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      defaultValue={act.assignee_id ?? ''}
                      onBlur={e => patchActivite(act.id, { assignee_id: e.target.value || null })}
                      onChange={e => patchActivite(act.id, { assignee_id: e.target.value || null })}>
                      <option value="">Non assigné</option>
                      {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                    </select>
                  ) : (
                    <div onClick={() => setEditingCell({ id: act.id, field: 'assignee' })} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: '100%' }}>
                      <Initials profile={act.assignee} />
                      <span style={{ fontSize: 12, color: act.assignee ? '#374151' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {act.assignee ? `${act.assignee.prenoms} ${act.assignee.nom}` : '—'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Statut */}
                <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'statut' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      defaultValue={act.statut}
                      onBlur={e => patchActivite(act.id, { statut: e.target.value })}
                      onChange={e => patchActivite(act.id, { statut: e.target.value })}>
                      {Object.entries(ACT_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <span onClick={() => setEditingCell({ id: act.id, field: 'statut' })}
                      style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {ACT_STATUT_LABELS[act.statut]}
                    </span>
                  )}
                </div>

                {/* Priorité */}
                <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'priorite' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      defaultValue={act.priorite}
                      onBlur={e => patchActivite(act.id, { priorite: e.target.value })}
                      onChange={e => patchActivite(act.id, { priorite: e.target.value })}>
                      {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <span onClick={() => setEditingCell({ id: act.id, field: 'priorite' })}
                      style={{ background: pc.bg, color: pc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {PRIO_LABELS[act.priorite]}
                    </span>
                  )}
                </div>

                {/* Échéance */}
                <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'date_echeance' ? (
                    <input autoFocus type="date" className="input" style={{ fontSize: 12, width: '100%', padding: '2px 6px' }}
                      defaultValue={act.date_echeance ?? ''}
                      onBlur={e => patchActivite(act.id, { date_echeance: e.target.value || null })}
                    />
                  ) : (
                    <span onClick={() => setEditingCell({ id: act.id, field: 'date_echeance' })}
                      style={{ fontSize: 12, color: isOverdue ? '#dc2626' : (act.date_echeance ? '#374151' : '#d1d5db'), cursor: 'pointer', fontWeight: isOverdue ? 700 : 400 }}>
                      {act.date_echeance ? new Date(act.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding: '11px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={() => deleteActivite(act.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: 2, lineHeight: 1 }}
                    title="Supprimer"
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                  >✕</button>
                </div>
              </div>
            )
          })}

          {/* Ligne ajout rapide */}
          {showAddRow && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px 110px 40px', borderTop: '1px solid #e5e7eb', background: '#fafffe' }}>
              <div style={{ padding: '8px 14px', borderRight: '1px solid #f3f4f6' }}>
                <input autoFocus className="input" placeholder="Nom de la tâche…" style={{ fontSize: 13 }}
                  value={taskForm.nom} onChange={e => setTaskForm(f => ({ ...f, nom: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddRow(false) }} />
              </div>
              <div style={{ padding: '8px 14px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                  <option value="">Non assigné</option>
                  {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 14px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.statut} onChange={e => setTaskForm(f => ({ ...f, statut: e.target.value }))}>
                  {Object.entries(ACT_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 14px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.priorite} onChange={e => setTaskForm(f => ({ ...f, priorite: e.target.value }))}>
                  {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 14px', borderRight: '1px solid #f3f4f6' }}>
                <input className="input" type="date" style={{ fontSize: 12 }} value={taskForm.date_echeance} onChange={e => setTaskForm(f => ({ ...f, date_echeance: e.target.value }))} />
              </div>
              <div style={{ padding: '8px', display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => addTask()} disabled={savingTask}>✓</button>
                <button onClick={() => setShowAddRow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
              </div>
            </div>
          )}

          {/* Footer ajout */}
          {!showAddRow && (
            <div onClick={() => setShowAddRow(true)}
              style={{ padding: '10px 14px', fontSize: 13, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--abed-green)'; e.currentTarget.style.background = '#f0fdf4' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'white' }}>
              <span style={{ fontSize: 16 }}>+</span> Ajouter une tâche
            </div>
          )}
        </div>
      )}

      {/* === VUE KANBAN === */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {COLUMNS.map(col => {
            const tasks = projet.activites.filter(a => a.statut === col)
            return (
              <div key={col} style={{ background: '#f9fafb', borderRadius: 14, padding: 14, minHeight: 300 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COL_COLORS[col] }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{ACT_STATUT_LABELS[col]}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 7px' }}>{tasks.length}</span>
                  </div>
                  <button onClick={() => { setShowNewTaskForm(col); setTaskForm(f => ({ ...f, statut: col })) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', fontSize: 18, lineHeight: 1, padding: 0 }}>+</button>
                </div>

                {showNewTaskForm === col && (
                  <div style={{ background: 'white', border: '1px solid var(--abed-green)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <input className="input" placeholder="Nom de la tâche *" style={{ fontSize: 13, marginBottom: 8 }}
                      value={taskForm.nom} onChange={e => setTaskForm(f => ({ ...f, nom: e.target.value }))}
                      autoFocus onKeyDown={e => e.key === 'Enter' && addTask(col)} />
                    <select className="select" style={{ fontSize: 12, marginBottom: 8 }} value={taskForm.priorite}
                      onChange={e => setTaskForm(f => ({ ...f, priorite: e.target.value }))}>
                      {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="select" style={{ fontSize: 12, marginBottom: 8 }} value={taskForm.assignee_id}
                      onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                      <option value="">Non assigné</option>
                      {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                    </select>
                    <input className="input" type="date" style={{ fontSize: 12, marginBottom: 10 }}
                      value={taskForm.date_echeance} onChange={e => setTaskForm(f => ({ ...f, date_echeance: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ fontSize: 12 }} disabled={savingTask} onClick={() => addTask(col)}>{savingTask ? '…' : 'Ajouter'}</button>
                      <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => setShowNewTaskForm(null)}>Annuler</button>
                    </div>
                  </div>
                )}

                {tasks.map(act => {
                  const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
                  const nbComments = act.commentaires_activites?.length ?? 0
                  return (
                    <div key={act.id} onClick={() => openActivite(act)}
                      style={{ background: 'white', border: `1px solid ${selectedActivite?.id === act.id ? 'var(--abed-green)' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--abed-green)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = selectedActivite?.id === act.id ? 'var(--abed-green)' : '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, paddingRight: 8 }}>{act.nom}</p>
                        <span style={{ background: pc.bg, color: pc.color, borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{PRIO_LABELS[act.priorite]}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Initials profile={act.assignee} />
                          {act.assignee && <span style={{ fontSize: 11, color: '#6b7280' }}>{act.assignee.prenoms}</span>}
                          {!act.assignee && <span style={{ fontSize: 11, color: '#9ca3af' }}>Non assigné</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af', alignItems: 'center' }}>
                          {act.date_echeance && <span>📅 {new Date(act.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                          {nbComments > 0 && <span>💬 {nbComments}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Panel latéral — détail tâche */}
      {selectedActivite && (
        <div style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 440, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header panel */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--abed-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#111827' }}>{selectedActivite.nom}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={selectedActivite.statut} onChange={e => patchActivite(selectedActivite.id, { statut: e.target.value })}
                  style={{ fontSize: 12, padding: '3px 8px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', cursor: 'pointer' }}>
                  {Object.entries(ACT_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <span style={{ background: PRIO_COLORS[selectedActivite.priorite]?.bg, color: PRIO_COLORS[selectedActivite.priorite]?.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {PRIO_LABELS[selectedActivite.priorite]}
                </span>
              </div>
            </div>
            <button onClick={() => setSelectedActivite(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 0 }}>✕</button>
          </div>

          {/* Infos */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedActivite.description && (
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{selectedActivite.description}</p>
            )}
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <div>
                <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 4 }}>Assigné à</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Initials profile={selectedActivite.assignee} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>
                    {selectedActivite.assignee ? `${selectedActivite.assignee.prenoms} ${selectedActivite.assignee.nom}` : 'Non assigné'}
                  </span>
                </div>
              </div>
              {selectedActivite.date_echeance && (
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 4 }}>Échéance</span>
                  <span style={{ color: '#374151', fontWeight: 600 }}>{new Date(selectedActivite.date_echeance).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Commentaires */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#374151' }}>Commentaires ({commentaires.length})</h4>
            {loadingComments && <p style={{ fontSize: 13, color: '#9ca3af' }}>Chargement…</p>}
            {commentaires.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', color: '#374151', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {`${c.auteur?.prenoms?.[0] ?? ''}${c.auteur?.nom?.[0] ?? ''}`.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{c.auteur?.prenoms} {c.auteur?.nom}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.contenu}</p>
                </div>
              </div>
            ))}
            {commentaires.length === 0 && !loadingComments && (
              <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucun commentaire encore.</p>
            )}
          </div>

          {/* Zone commentaire */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--abed-border)', display: 'flex', gap: 8 }}>
            <textarea placeholder="Ajouter un commentaire…"
              value={newComment} onChange={e => setNewComment(e.target.value)}
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
              style={{ flex: 1, resize: 'none', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={addComment} disabled={sendingComment || !newComment.trim()}
              style={{ background: newComment.trim() ? 'var(--abed-green)' : '#d1d5db', color: 'white', border: 'none', borderRadius: 10, width: 40, cursor: newComment.trim() ? 'pointer' : 'default', fontSize: 16 }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
