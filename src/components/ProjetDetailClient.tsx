'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { id: string; nom: string; prenoms: string }
type Commentaire = { id: string; contenu: string; created_at: string; auteur: { nom: string; prenoms: string; avatar_url?: string } | null }
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
  basse:    { bg: '#f3f4f6', color: '#6b7280' },
  normale:  { bg: '#dbeafe', color: '#1e40af' },
  haute:    { bg: '#fef3c7', color: '#92400e' },
  urgente:  { bg: '#fee2e2', color: '#991b1b' },
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
  const [selectedActivite, setSelectedActivite] = useState<Activite | null>(null)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showNewTaskForm, setShowNewTaskForm] = useState<string | null>(null) // column statut
  const [taskForm, setTaskForm] = useState({ nom: '', description: '', priorite: 'normale', assignee_id: '', date_echeance: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [editingStatut, setEditingStatut] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function changeActiviteStatut(activiteId: string, statut: string) {
    const r = await fetch(`/api/activites/${activiteId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    const j = await r.json()
    if (r.ok) {
      setProjet(p => ({ ...p, activites: p.activites.map(a => a.id === activiteId ? j.data : a) }))
      if (selectedActivite?.id === activiteId) setSelectedActivite(j.data)
    }
  }

  async function addTask(statut: string) {
    if (!taskForm.nom.trim()) return
    setSavingTask(true)
    const r = await fetch('/api/activites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...taskForm, projet_id: projet.id, statut, assignee_id: taskForm.assignee_id || null }),
    })
    const j = await r.json()
    if (r.ok) {
      setProjet(p => ({ ...p, activites: [...p.activites, j.data] }))
      setTaskForm({ nom: '', description: '', priorite: 'normale', assignee_id: '', date_echeance: '' })
      setShowNewTaskForm(null)
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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/projets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12 }}>
          ← Tous les projets
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: '0 0 6px' }}>{projet.nom}</h1>
            {projet.description && <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 10px' }}>{projet.description}</p>}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: '#9ca3af' }}>
              {editingStatut ? (
                <select autoFocus className="select" style={{ fontSize: 13 }}
                  defaultValue={projet.statut} onBlur={e => changeProjetStatut(e.target.value)} onChange={e => changeProjetStatut(e.target.value)}>
                  {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span onClick={() => isCreator && setEditingStatut(true)}
                  style={{ cursor: isCreator ? 'pointer' : 'default', background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                  {STATUT_LABELS[projet.statut]}
                </span>
              )}
              <span>Par {projet.created_by_profile ? `${projet.created_by_profile.prenoms} ${projet.created_by_profile.nom}` : '—'}</span>
              {projet.date_debut && <span>Début : {new Date(projet.date_debut).toLocaleDateString('fr-FR')}</span>}
              {projet.date_fin && <span>Fin : {new Date(projet.date_fin).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: pct === 100 ? '#16a34a' : 'var(--abed-green)' }}>{pct}%</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{done}/{total} tâches</div>
            </div>
            {isCreator && (
              <button onClick={deleteProjet} disabled={deleting}
                style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                {deleting ? '…' : '🗑 Supprimer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {COLUMNS.map(col => {
          const tasks = projet.activites.filter(a => a.statut === col)
          return (
            <div key={col} style={{ background: '#f9fafb', borderRadius: 14, padding: 14, minHeight: 300 }}>
              {/* Colonne header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: COL_COLORS[col] }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{ACT_STATUT_LABELS[col]}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 7px' }}>{tasks.length}</span>
                </div>
                <button onClick={() => setShowNewTaskForm(col)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', fontSize: 18, lineHeight: 1, padding: 0 }}>+</button>
              </div>

              {/* Formulaire nouvelle tâche */}
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

              {/* Cartes de tâches */}
              {tasks.map(act => {
                const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
                const nbComments = act.commentaires_activites?.length ?? 0
                return (
                  <div key={act.id} onClick={() => openActivite(act)}
                    style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--abed-green)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, paddingRight: 8 }}>{act.nom}</p>
                      <span style={{ background: pc.bg, color: pc.color, borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {PRIO_LABELS[act.priorite]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Initials profile={act.assignee} />
                        {act.assignee && <span style={{ fontSize: 11, color: '#6b7280' }}>{act.assignee.prenoms}</span>}
                        {!act.assignee && <span style={{ fontSize: 11, color: '#9ca3af' }}>Non assigné</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#9ca3af', alignItems: 'center' }}>
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

      {/* Panel latéral — détail tâche */}
      {selectedActivite && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header panel */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--abed-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#111827' }}>{selectedActivite.nom}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Changer statut */}
                <select value={selectedActivite.statut} onChange={e => changeActiviteStatut(selectedActivite.id, e.target.value)}
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
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedActivite.description && (
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{selectedActivite.description}</p>
            )}
            <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
              <div>
                <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 3 }}>Assigné à</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Initials profile={selectedActivite.assignee} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>
                    {selectedActivite.assignee ? `${selectedActivite.assignee.prenoms} ${selectedActivite.assignee.nom}` : 'Non assigné'}
                  </span>
                </div>
              </div>
              {selectedActivite.date_echeance && (
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 3 }}>Échéance</span>
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
              <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucun commentaire. Soyez le premier !</p>
            )}
          </div>

          {/* Zone de saisie commentaire */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--abed-border)', display: 'flex', gap: 8 }}>
            <textarea
              placeholder="Ajouter un commentaire…"
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

      {/* Overlay */}
      {selectedActivite && (
        <div onClick={() => setSelectedActivite(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 199 }} />
      )}
    </div>
  )
}
