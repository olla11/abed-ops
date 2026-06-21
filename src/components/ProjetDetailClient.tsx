'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

type Profile = { id: string; nom: string; prenoms: string }
type Commentaire = { id: string; contenu: string; created_at: string; auteur: { nom: string; prenoms: string } | null }
type Activite = {
  id: string; nom: string; description: string | null; statut: string; priorite: string
  assignee_id: string | null; date_echeance: string | null; created_by: string | null
  created_at: string
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
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ── Modal de confirmation générique ────────────────────────────────────────
type ModalStep = { title: string; body: string; confirmLabel: string; danger?: boolean }
function ConfirmModal({ steps, onConfirm, onCancel }: { steps: ModalStep[]; onConfirm: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '32px 28px', width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: current.danger ? '#fee2e2' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {current.danger ? '⚠️' : '❓'}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827' }}>{current.title}</p>
            {steps.length > 1 && (
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Étape {step + 1} sur {steps.length}</p>
            )}
          </div>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{current.body}</p>
        {steps.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= step ? (current.danger ? '#dc2626' : '#f59e0b') : '#e5e7eb' }} />
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={() => { if (isLast) onConfirm(); else setStep(s => s + 1) }}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: current.danger ? '#dc2626' : '#f59e0b', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Initials({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  const txt = `${profile.prenoms?.[0] ?? ''}${profile.nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--abed-green)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {txt}
    </div>
  )
}

function CalendrierPicker({ value, onChange, onClose, triggerRect }: { value: string | null; onChange: (v: string | null) => void; onClose: () => void; triggerRect: DOMRect }) {
  const today = new Date()
  const initDate = value ? new Date(value + 'T12:00:00') : today
  const [year, setYear] = useState(initDate.getFullYear())
  const [month, setMonth] = useState(initDate.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (firstDay + 6) % 7
  const todayStr = today.toISOString().slice(0, 10)

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const W = 260
  const left = Math.min(triggerRect.left, window.innerWidth - W - 8)
  const top = triggerRect.bottom + 6

  return createPortal(
    <div ref={ref} style={{ position: 'fixed', zIndex: 9999, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 14, width: W, top, left }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={e => { e.stopPropagation(); prevMonth() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#374151', lineHeight: 1, padding: '2px 8px', borderRadius: 6 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{MOIS_FR[month]} {year}</span>
        <button onClick={e => { e.stopPropagation(); nextMonth() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#374151', lineHeight: 1, padding: '2px 8px', borderRadius: 6 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {['Lu','Ma','Me','Je','Ve','Sa','Di'].map(j => (
          <div key={j} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '2px 0' }}>{j}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr
          return (
            <button key={i} onClick={e => { e.stopPropagation(); onChange(dateStr); onClose() }}
              style={{
                background: isSelected ? 'var(--abed-green)' : isToday ? '#f0fdf4' : 'none',
                color: isSelected ? 'white' : isToday ? 'var(--abed-green)' : '#374151',
                border: isToday && !isSelected ? '1px solid var(--abed-green)' : '1px solid transparent',
                borderRadius: 6, fontSize: 12, padding: '5px 0', cursor: 'pointer', fontWeight: isSelected || isToday ? 700 : 400,
              }}>
              {day}
            </button>
          )
        })}
      </div>
      {value && (
        <button onClick={e => { e.stopPropagation(); onChange(null); onClose() }}
          style={{ marginTop: 10, width: '100%', background: '#fef2f2', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
          Effacer la date
        </button>
      )}
    </div>,
    document.body
  )
}

export default function ProjetDetailClient({ projet: initial, userId, allProfiles }: { projet: Projet; userId: string; allProfiles: Profile[] }) {
  const router = useRouter()
  const [projet, setProjet] = useState<Projet>(initial)
  const [view, setView] = useState<'table' | 'kanban' | 'calendrier' | 'gantt' | 'tableur'>('table')
  const [selectedActivite, setSelectedActivite] = useState<Activite | null>(null)
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showNewTaskForm, setShowNewTaskForm] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ nom: '', priorite: 'normale', assignee_id: '', date_echeance: '', statut: 'a_faire' })
  const [savingTask, setSavingTask] = useState(false)
  const [editingStatut, setEditingStatut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteProjetModal, setDeleteProjetModal] = useState(false)
  const [deleteActiviteId, setDeleteActiviteId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [calendarFor, setCalendarFor] = useState<{ id: string; rect: DOMRect } | null>(null)
  const [addRowCalendar, setAddRowCalendar] = useState<DOMRect | null>(null)

  // Calendrier view state
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  // Tableur view state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [tableurAddRow, setTableurAddRow] = useState<string | null>(null)
  const [tableurAddCalendar, setTableurAddCalendar] = useState<DOMRect | null>(null)

  // Gantt
  const ganttRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (view === 'gantt' && ganttRef.current) {
      ganttRef.current.scrollLeft = 21 * 28 - 100
    }
  }, [view])

  useEffect(() => {
    if (selectedActivite) {
      document.body.classList.add('panel-open')
    } else {
      document.body.classList.remove('panel-open')
    }
    return () => document.body.classList.remove('panel-open')
  }, [selectedActivite])

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
    // Optimistic update — apply immediately, revert on failure
    const prevActivites = projet.activites
    const prevSelected = selectedActivite

    // Build enriched patch (resolve assignee profile for display)
    const optimisticPatch: Partial<Activite> = { ...patch } as any
    if ('assignee_id' in patch) {
      optimisticPatch.assignee = patch.assignee_id
        ? (allProfiles.find(p => p.id === patch.assignee_id) ?? null)
        : null
    }

    setProjet(p => ({ ...p, activites: p.activites.map(a => a.id === activiteId ? { ...a, ...optimisticPatch } : a) }))
    if (selectedActivite?.id === activiteId) setSelectedActivite(prev => prev ? { ...prev, ...optimisticPatch } : null)
    setEditingCell(null)
    setCalendarFor(null)

    const r = await fetch(`/api/activites/${activiteId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (r.ok) {
      const j = await r.json()
      setProjet(p => ({ ...p, activites: p.activites.map(a => a.id === activiteId ? { ...a, ...j.data } : a) }))
      if (selectedActivite?.id === activiteId || prevSelected?.id === activiteId)
        setSelectedActivite(prev => prev ? { ...prev, ...j.data } : null)
    } else {
      // Revert
      setProjet(p => ({ ...p, activites: prevActivites }))
      setSelectedActivite(prevSelected)
    }
  }

  async function toggleDone(act: Activite) {
    const newStatut = act.statut === 'termine' ? 'a_faire' : 'termine'
    await patchActivite(act.id, { statut: newStatut })
  }

  async function deleteActivite(activiteId: string) {
    await fetch(`/api/activites/${activiteId}`, { method: 'DELETE' })
    setProjet(p => ({ ...p, activites: p.activites.filter(a => a.id !== activiteId) }))
    if (selectedActivite?.id === activiteId) setSelectedActivite(null)
    setDeleteActiviteId(null)
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
      setTaskForm({ nom: '', priorite: 'normale', assignee_id: '', date_echeance: '', statut: 'a_faire' })
      setShowNewTaskForm(null)
      setShowAddRow(false)
      setTableurAddRow(null)
    }
    setSavingTask(false)
  }

  async function deleteProjet() {
    setDeleting(true)
    setDeleteProjetModal(false)
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
  const PSC: Record<string, { bg: string; color: string }> = {
    planifie: { bg: '#dbeafe', color: '#1e40af' }, en_cours: { bg: '#dcfce7', color: '#166534' },
    en_pause: { bg: '#fef3c7', color: '#92400e' }, termine: { bg: '#f3f4f6', color: '#374151' },
    annule:   { bg: '#fee2e2', color: '#991b1b' },
  }
  const psc = PSC[projet.statut] ?? PSC.en_cours

  // ── Calendrier helpers ──────────────────────────────────────────────
  function calPrevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function calNextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  function buildCalCells() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const startOffset = (firstDay + 6) % 7
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate()
    const cells: { date: string; day: number; isCurrentMonth: boolean }[] = []
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = calMonth === 0 ? 12 : calMonth
      const y = calMonth === 0 ? calYear - 1 : calYear
      cells.push({ date: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrentMonth: true })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = calMonth === 11 ? 1 : calMonth + 2
      const y = calMonth === 11 ? calYear + 1 : calYear
      cells.push({ date: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, day: d, isCurrentMonth: false })
    }
    return cells
  }

  // ── Gantt helpers ───────────────────────────────────────────────────
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
  const ganttStart = new Date(todayDate); ganttStart.setDate(ganttStart.getDate() - 21)
  const ganttEnd = new Date(todayDate); ganttEnd.setDate(ganttEnd.getDate() + 49)
  const ganttTotalDays = 70
  const DAY_W = 28

  function ganttDayOffset(d: Date) {
    return Math.round((d.getTime() - ganttStart.getTime()) / 86400000)
  }

  function buildGanttDays() {
    const days: { date: Date; weekStart: boolean }[] = []
    for (let i = 0; i < ganttTotalDays; i++) {
      const d = new Date(ganttStart)
      d.setDate(d.getDate() + i)
      days.push({ date: d, weekStart: d.getDay() === 1 })
    }
    return days
  }

  const todayOffset = ganttDayOffset(todayDate)

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
                <select autoFocus className="select" style={{ fontSize: 12 }} defaultValue={projet.statut}
                  onChange={e => changeProjetStatut(e.target.value)} onBlur={() => setEditingStatut(false)}>
                  {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span onClick={() => isCreator && setEditingStatut(true)} title={isCreator ? 'Cliquer pour modifier' : ''}
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
          {isCreator && (
            <button onClick={() => setDeleteProjetModal(true)} disabled={deleting}
              style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
              {deleting ? '…' : '🗑 Supprimer'}
            </button>
          )}
        </div>
        <div style={{ marginTop: 14, height: 5, background: '#f3f4f6', borderRadius: 999 }}>
          <div style={{ height: 5, borderRadius: 999, background: pct === 100 ? '#16a34a' : 'var(--abed-green)', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Toggle vue */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'table', label: '≡ Liste' },
          { key: 'kanban', label: '⬜ Tableau' },
          { key: 'calendrier', label: '📅 Calendrier' },
          { key: 'gantt', label: '📊 Gantt' },
          { key: 'tableur', label: '🗒 Tableur' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key as typeof view)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: view === v.key ? 700 : 500, color: view === v.key ? 'var(--abed-green)' : '#6b7280', borderBottom: view === v.key ? '2px solid var(--abed-green)' : '2px solid transparent', marginBottom: -1 }}>
            {v.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setShowAddRow(true); setView('table') }} style={{ fontSize: 12, marginBottom: 6 }}>+ Ajouter une tâche</button>
      </div>

      {/* === VUE TABLE === */}
      {view === 'table' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRadius: '12px 12px 0 0' }}>
            {['', 'Nom', 'Assigné', 'Statut', 'Priorité', 'Échéance', ''].map((h, i) => (
              <div key={i} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', borderRight: i < 6 ? '1px solid #f3f4f6' : 'none' }}>{h}</div>
            ))}
          </div>

          {projet.activites.length === 0 && !showAddRow && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Aucune tâche — cliquez sur "+ Ajouter une tâche" pour commencer.
            </div>
          )}

          {projet.activites.map(act => {
            const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
            const sc = ACT_STATUT_COLORS[act.statut] ?? ACT_STATUT_COLORS.a_faire
            const isSelected = selectedActivite?.id === act.id
            const isDone = act.statut === 'termine'
            const todayD = new Date(); todayD.setHours(0, 0, 0, 0)
            const isOverdue = act.date_echeance && new Date(act.date_echeance + 'T00:00:00') < todayD && !isDone

            return (
              <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', borderBottom: '1px solid #f3f4f6', background: isSelected ? '#f0fdf4' : 'white', position: 'relative' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white' }}>

                <div onClick={() => toggleDone(act)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRight: '1px solid #f3f4f6' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isDone ? '#16a34a' : COL_COLORS[act.statut] ?? '#6b7280'}`, background: isDone ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    {isDone && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>

                <div onClick={() => openActivite(act)} style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRight: '1px solid #f3f4f6', minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#9ca3af' : '#111827', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.nom}</span>
                  {(act.commentaires_activites?.length ?? 0) > 0 && <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>💬 {act.commentaires_activites.length}</span>}
                </div>

                <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'assignee' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      value={act.assignee_id ?? ''}
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

                <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'statut' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      value={act.statut}
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

                <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  {editingCell?.id === act.id && editingCell.field === 'priorite' ? (
                    <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                      value={act.priorite}
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

                <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                  <span onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setCalendarFor(calendarFor?.id === act.id ? null : { id: act.id, rect: r }) }}
                    style={{ fontSize: 12, color: isOverdue ? '#dc2626' : (act.date_echeance ? '#374151' : '#9ca3af'), cursor: 'pointer', fontWeight: isOverdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {act.date_echeance
                      ? new Date(act.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                      : '+ date'}
                  </span>
                  {calendarFor?.id === act.id && (
                    <CalendrierPicker
                      value={act.date_echeance}
                      onChange={v => patchActivite(act.id, { date_echeance: v })}
                      onClose={() => setCalendarFor(null)}
                      triggerRect={calendarFor.rect}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={() => setDeleteActiviteId(act.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>✕</button>
                </div>
              </div>
            )
          })}

          {showAddRow && (
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', borderTop: '2px solid var(--abed-green)', background: '#fafffe' }}>
              <div style={{ borderRight: '1px solid #f3f4f6' }} />
              <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                <input autoFocus className="input" placeholder="Nom de la tâche…" style={{ fontSize: 13 }}
                  value={taskForm.nom} onChange={e => setTaskForm(f => ({ ...f, nom: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddRow(false) }} />
              </div>
              <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                  <option value="">Non assigné</option>
                  {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.statut} onChange={e => setTaskForm(f => ({ ...f, statut: e.target.value }))}>
                  {Object.entries(ACT_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                <select className="select" style={{ fontSize: 12 }} value={taskForm.priorite} onChange={e => setTaskForm(f => ({ ...f, priorite: e.target.value }))}>
                  {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                <span onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setAddRowCalendar(v => v ? null : r) }}
                  style={{ fontSize: 12, color: taskForm.date_echeance ? '#374151' : '#9ca3af', cursor: 'pointer' }}>
                  {taskForm.date_echeance
                    ? new Date(taskForm.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                    : '+ date'}
                </span>
                {addRowCalendar && (
                  <CalendrierPicker
                    value={taskForm.date_echeance || null}
                    onChange={v => { setTaskForm(f => ({ ...f, date_echeance: v ?? '' })); setAddRowCalendar(null) }}
                    onClose={() => setAddRowCalendar(null)}
                    triggerRect={addRowCalendar}
                  />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <button className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => addTask()} disabled={savingTask}>✓</button>
              </div>
            </div>
          )}

          {!showAddRow && (
            <div onClick={() => setShowAddRow(true)}
              style={{ padding: '10px 14px', fontSize: 13, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '0 0 12px 12px' }}
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
                    <select className="select" style={{ fontSize: 12, marginBottom: 8 }} value={taskForm.priorite} onChange={e => setTaskForm(f => ({ ...f, priorite: e.target.value }))}>
                      {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="select" style={{ fontSize: 12, marginBottom: 8 }} value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                      <option value="">Non assigné</option>
                      {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ fontSize: 12 }} disabled={savingTask} onClick={() => addTask(col)}>{savingTask ? '…' : 'Ajouter'}</button>
                      <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => setShowNewTaskForm(null)}>Annuler</button>
                    </div>
                  </div>
                )}
                {tasks.map(act => {
                  const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
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
                          {act.assignee ? <span style={{ fontSize: 11, color: '#6b7280' }}>{act.assignee.prenoms}</span> : <span style={{ fontSize: 11, color: '#9ca3af' }}>Non assigné</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af', alignItems: 'center' }}>
                          {act.date_echeance && <span>📅 {new Date(act.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                          {(act.commentaires_activites?.length ?? 0) > 0 && <span>💬 {act.commentaires_activites.length}</span>}
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

      {/* === VUE CALENDRIER === */}
      {view === 'calendrier' && (() => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const cells = buildCalCells()
        return (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <button onClick={calPrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#374151', padding: '2px 10px', borderRadius: 6 }}>‹</button>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{MOIS_FR[calMonth]} {calYear}</span>
              <button onClick={calNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#374151', padding: '2px 10px', borderRadius: 6 }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
              {['Lu','Ma','Me','Je','Ve','Sa','Di'].map(j => (
                <div key={j} style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>{j}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((cell, i) => {
                const isToday = cell.date === todayStr
                const dayTasks = projet.activites.filter(a => a.date_echeance === cell.date)
                const shown = dayTasks.slice(0, 3)
                const extra = dayTasks.length - shown.length
                return (
                  <div key={i} style={{
                    minHeight: 110,
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none',
                    borderBottom: i < cells.length - 7 ? '1px solid #f3f4f6' : 'none',
                    background: isToday ? '#f0fdf4' : 'white',
                    padding: 6,
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: isToday ? 800 : 500,
                        color: isToday ? 'var(--abed-green)' : cell.isCurrentMonth ? '#374151' : '#d1d5db',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: isToday ? 24 : 'auto', height: isToday ? 24 : 'auto',
                        borderRadius: isToday ? '50%' : 0,
                        background: isToday ? '#dcfce7' : 'none',
                      }}>{cell.day}</span>
                      {cell.isCurrentMonth && (
                        <button
                          onClick={() => {
                            setTaskForm(f => ({ ...f, date_echeance: cell.date, statut: 'a_faire', nom: '', assignee_id: '', priorite: 'normale' }))
                            setShowAddRow(true)
                            setView('table')
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '0 2px', lineHeight: 1, opacity: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                          title="Ajouter une tâche ce jour">+</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {shown.map(act => {
                        const actSc = ACT_STATUT_COLORS[act.statut] ?? ACT_STATUT_COLORS.a_faire
                        return (
                          <div key={act.id} onClick={() => openActivite(act)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 4px', borderRadius: 4, background: actSc.bg }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: COL_COLORS[act.statut] ?? '#6b7280', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: actSc.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{act.nom}</span>
                          </div>
                        )
                      })}
                      {extra > 0 && (
                        <span style={{ fontSize: 10, color: '#9ca3af', paddingLeft: 4 }}>+{extra} autre{extra > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* === VUE GANTT === */}
      {view === 'gantt' && (() => {
        const ganttDays = buildGanttDays()
        return (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', overflow: 'hidden' }}>
              {/* Left: task names */}
              <div style={{ width: 250, flexShrink: 0, borderRight: '1px solid #e5e7eb', zIndex: 2, background: 'white' }}>
                <div style={{ height: 56, display: 'flex', alignItems: 'flex-end', padding: '0 14px 8px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Tâche</span>
                </div>
                {projet.activites.map(act => (
                  <div key={act.id}
                    onClick={() => openActivite(act)}
                    style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selectedActivite?.id === act.id ? '#f0fdf4' : 'white' }}
                    onMouseEnter={e => { if (selectedActivite?.id !== act.id) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={e => { if (selectedActivite?.id !== act.id) e.currentTarget.style.background = 'white' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{act.nom}</span>
                    {act.assignee && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--abed-green)', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {`${act.assignee.prenoms?.[0] ?? ''}${act.assignee.nom?.[0] ?? ''}`.toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {projet.activites.length === 0 && (
                  <div style={{ padding: '20px 14px', fontSize: 13, color: '#9ca3af' }}>Aucune tâche</div>
                )}
              </div>

              {/* Right: scrollable timeline */}
              <div ref={ganttRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                <div style={{ width: ganttTotalDays * DAY_W, minWidth: '100%', position: 'relative' }}>
                  {/* Header: week labels */}
                  <div style={{ height: 28, display: 'flex', alignItems: 'center', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'relative' }}>
                    {ganttDays.map((d, i) => {
                      if (!d.weekStart && i !== 0) return null
                      const weekLabel = d.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      return (
                        <div key={i} style={{ position: 'absolute', left: i * DAY_W, fontSize: 10, fontWeight: 700, color: '#6b7280', paddingLeft: 4, whiteSpace: 'nowrap' }}>
                          {weekLabel}
                        </div>
                      )
                    })}
                  </div>
                  {/* Header: day numbers */}
                  <div style={{ height: 28, display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {ganttDays.map((d, i) => {
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
                      const isTodayCol = i === todayOffset
                      return (
                        <div key={i} style={{
                          width: DAY_W, flexShrink: 0, textAlign: 'center', fontSize: 10,
                          fontWeight: isTodayCol ? 800 : 400,
                          color: isTodayCol ? 'var(--abed-green)' : isWeekend ? '#d1d5db' : '#9ca3af',
                          borderLeft: d.weekStart ? '1px solid #e5e7eb' : 'none',
                          lineHeight: '28px',
                        }}>
                          {d.date.getDate()}
                        </div>
                      )
                    })}
                  </div>

                  {/* Task rows */}
                  {projet.activites.map(act => {
                    const actSc = ACT_STATUT_COLORS[act.statut] ?? ACT_STATUT_COLORS.a_faire
                    const rawStart = new Date(act.created_at); rawStart.setHours(0,0,0,0)
                    const taskStart = rawStart < ganttStart ? ganttStart : rawStart
                    const startOff = Math.max(0, ganttDayOffset(taskStart))

                    let endOff: number | null = null
                    let hasDue = false
                    if (act.date_echeance) {
                      const dueDate = new Date(act.date_echeance + 'T00:00:00')
                      endOff = Math.min(ganttTotalDays, ganttDayOffset(dueDate) + 1)
                      hasDue = true
                    }

                    return (
                      <div key={act.id} style={{ height: 40, position: 'relative', borderBottom: '1px solid #f3f4f6', background: selectedActivite?.id === act.id ? '#f0fdf4' : 'white' }}>
                        {ganttDays.map((d, i) => {
                          const weekNum = Math.floor(i / 7)
                          const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
                          return (
                            <div key={i} style={{
                              position: 'absolute', top: 0, bottom: 0, left: i * DAY_W, width: DAY_W,
                              background: isWeekend ? '#fafafa' : weekNum % 2 === 0 ? 'transparent' : '#f9fafb',
                              borderLeft: d.weekStart ? '1px solid #f3f4f6' : 'none',
                            }} />
                          )
                        })}

                        {todayOffset >= 0 && todayOffset < ganttTotalDays && (
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: todayOffset * DAY_W + DAY_W / 2, width: 2, background: '#16a34a', opacity: 0.6, zIndex: 1 }} />
                        )}

                        {hasDue && endOff !== null && endOff > startOff ? (
                          <div style={{
                            position: 'absolute',
                            top: '50%', transform: 'translateY(-50%)',
                            left: startOff * DAY_W + 2,
                            width: Math.max(4, (endOff - startOff) * DAY_W - 4),
                            height: 8, borderRadius: 4,
                            background: actSc.bg,
                            border: `1px solid ${actSc.color}`,
                            zIndex: 2,
                          }} />
                        ) : !hasDue ? (
                          <div style={{
                            position: 'absolute',
                            top: '50%', transform: 'translateY(-50%)',
                            left: todayOffset * DAY_W + DAY_W / 2 - 5,
                            width: 10, height: 10, borderRadius: '50%',
                            background: actSc.color,
                            zIndex: 2,
                          }} />
                        ) : null}
                      </div>
                    )
                  })}

                  {projet.activites.length === 0 && (
                    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                      Aucune tâche
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* === VUE TABLEUR === */}
      {view === 'tableur' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRadius: '12px 12px 0 0' }}>
            {['', 'Nom', 'Assigné', 'Statut', 'Priorité', 'Échéance', ''].map((h, i) => (
              <div key={i} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', borderRight: i < 6 ? '1px solid #f3f4f6' : 'none' }}>{h}</div>
            ))}
          </div>

          {COLUMNS.map(col => {
            const tasks = projet.activites.filter(a => a.statut === col)
            const isCollapsed = collapsed[col] ?? false
            const sc = ACT_STATUT_COLORS[col]

            return (
              <div key={col}>
                {/* Section header */}
                <div
                  onClick={() => setCollapsed(c => ({ ...c, [col]: !c[col] }))}
                  style={{ display: 'grid', gridTemplateColumns: '36px 1fr', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COL_COLORS[col], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: sc.color }}>{ACT_STATUT_LABELS[col]}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 7px' }}>{tasks.length}</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    {tasks.map(act => {
                      const pc = PRIO_COLORS[act.priorite] ?? PRIO_COLORS.normale
                      const actSc = ACT_STATUT_COLORS[act.statut] ?? ACT_STATUT_COLORS.a_faire
                      const isSelected = selectedActivite?.id === act.id
                      const isDone = act.statut === 'termine'
                      const todayD = new Date(); todayD.setHours(0, 0, 0, 0)
                      const isOverdue = act.date_echeance && new Date(act.date_echeance + 'T00:00:00') < todayD && !isDone

                      return (
                        <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', borderBottom: '1px solid #f3f4f6', background: isSelected ? '#f0fdf4' : 'white', position: 'relative' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fafafa' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white' }}>

                          <div onClick={() => toggleDone(act)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRight: '1px solid #f3f4f6' }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isDone ? '#16a34a' : COL_COLORS[act.statut] ?? '#6b7280'}`, background: isDone ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                              {isDone && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </div>

                          <div onClick={() => openActivite(act)} style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRight: '1px solid #f3f4f6', minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#9ca3af' : '#111827', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.nom}</span>
                            {(act.commentaires_activites?.length ?? 0) > 0 && <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>💬 {act.commentaires_activites.length}</span>}
                          </div>

                          <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #f3f4f6' }}>
                            {editingCell?.id === act.id && editingCell.field === 'assignee' ? (
                              <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                                value={act.assignee_id ?? ''}
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

                          <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                            {editingCell?.id === act.id && editingCell.field === 'statut' ? (
                              <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                                value={act.statut}
                                onChange={e => patchActivite(act.id, { statut: e.target.value })}>
                                {Object.entries(ACT_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            ) : (
                              <span onClick={() => setEditingCell({ id: act.id, field: 'statut' })}
                                style={{ background: actSc.bg, color: actSc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {ACT_STATUT_LABELS[act.statut]}
                              </span>
                            )}
                          </div>

                          <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                            {editingCell?.id === act.id && editingCell.field === 'priorite' ? (
                              <select autoFocus className="select" style={{ fontSize: 12, width: '100%' }}
                                value={act.priorite}
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

                          <div style={{ padding: '11px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid #f3f4f6' }}>
                            <span onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setCalendarFor(calendarFor?.id === act.id ? null : { id: act.id, rect: r }) }}
                              style={{ fontSize: 12, color: isOverdue ? '#dc2626' : (act.date_echeance ? '#374151' : '#9ca3af'), cursor: 'pointer', fontWeight: isOverdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                              {act.date_echeance
                                ? new Date(act.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                                : '+ date'}
                            </span>
                            {calendarFor?.id === act.id && (
                              <CalendrierPicker
                                value={act.date_echeance}
                                onChange={v => patchActivite(act.id, { date_echeance: v })}
                                onClose={() => setCalendarFor(null)}
                                triggerRect={calendarFor.rect}
                              />
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button onClick={() => deleteActivite(act.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>✕</button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add row for this section */}
                    {tableurAddRow === col ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 170px 140px 110px 130px 36px', borderBottom: '1px solid #f3f4f6', background: '#fafffe', borderTop: `2px solid ${COL_COLORS[col]}` }}>
                        <div style={{ borderRight: '1px solid #f3f4f6' }} />
                        <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                          <input autoFocus className="input" placeholder="Nom de la tâche…" style={{ fontSize: 13 }}
                            value={taskForm.nom} onChange={e => setTaskForm(f => ({ ...f, nom: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addTask(col); if (e.key === 'Escape') setTableurAddRow(null) }} />
                        </div>
                        <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                          <select className="select" style={{ fontSize: 12 }} value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                            <option value="">Non assigné</option>
                            {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
                          </select>
                        </div>
                        <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center' }}>
                          <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{ACT_STATUT_LABELS[col]}</span>
                        </div>
                        <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                          <select className="select" style={{ fontSize: 12 }} value={taskForm.priorite} onChange={e => setTaskForm(f => ({ ...f, priorite: e.target.value }))}>
                            {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div style={{ padding: '8px 10px', borderRight: '1px solid #f3f4f6' }}>
                          <span onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTableurAddCalendar(v => v ? null : r) }}
                            style={{ fontSize: 12, color: taskForm.date_echeance ? '#374151' : '#9ca3af', cursor: 'pointer' }}>
                            {taskForm.date_echeance
                              ? new Date(taskForm.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                              : '+ date'}
                          </span>
                          {tableurAddCalendar && (
                            <CalendrierPicker
                              value={taskForm.date_echeance || null}
                              onChange={v => { setTaskForm(f => ({ ...f, date_echeance: v ?? '' })); setTableurAddCalendar(null) }}
                              onClose={() => setTableurAddCalendar(null)}
                              triggerRect={tableurAddCalendar}
                            />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button className="btn" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => addTask(col)} disabled={savingTask}>✓</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setTableurAddRow(col); setTaskForm(f => ({ ...f, nom: '', statut: col, date_echeance: '', assignee_id: '', priorite: 'normale' })) }}
                        style={{ padding: '8px 14px 8px 46px', fontSize: 12, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => { e.currentTarget.style.color = COL_COLORS[col]; e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'white' }}>
                        <span style={{ fontSize: 14 }}>+</span> Ajouter une tâche
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #e5e7eb', borderRadius: '0 0 12px 12px', background: '#f9fafb' }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Total : <strong style={{ color: '#374151' }}>{projet.activites.length}</strong> tâche{projet.activites.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Panel latéral */}
      {selectedActivite && (
        <div style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 440, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--abed-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div onClick={() => toggleDone(selectedActivite)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selectedActivite.statut === 'termine' ? '#16a34a' : '#d1d5db'}`, background: selectedActivite.statut === 'termine' ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedActivite.statut === 'termine' && <svg width="11" height="9" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: selectedActivite.statut === 'termine' ? '#9ca3af' : '#111827', textDecoration: selectedActivite.statut === 'termine' ? 'line-through' : 'none' }}>{selectedActivite.nom}</p>
              </div>
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
            <button onClick={() => setSelectedActivite(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 0 }}>✕</button>
          </div>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedActivite.description && <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{selectedActivite.description}</p>}
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <div>
                <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 4 }}>Assigné à</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Initials profile={selectedActivite.assignee} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>{selectedActivite.assignee ? `${selectedActivite.assignee.prenoms} ${selectedActivite.assignee.nom}` : 'Non assigné'}</span>
                </div>
              </div>
              {selectedActivite.date_echeance && (
                <div>
                  <span style={{ color: '#9ca3af', display: 'block', fontSize: 11, marginBottom: 4 }}>Échéance</span>
                  <span style={{ color: '#374151', fontWeight: 600 }}>{new Date(selectedActivite.date_echeance + 'T12:00:00').toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>
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
            {commentaires.length === 0 && !loadingComments && <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucun commentaire encore.</p>}
          </div>
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--abed-border)', display: 'flex', gap: 8 }}>
            <textarea placeholder="Ajouter un commentaire…" value={newComment} onChange={e => setNewComment(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
              style={{ flex: 1, resize: 'none', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={addComment} disabled={sendingComment || !newComment.trim()}
              style={{ background: newComment.trim() ? 'var(--abed-green)' : '#d1d5db', color: 'white', border: 'none', borderRadius: 10, width: 40, cursor: newComment.trim() ? 'pointer' : 'default', fontSize: 16 }}>➤</button>
          </div>
        </div>
      )}

      {/* Modal suppression projet — 3 étapes */}
      {deleteProjetModal && (
        <ConfirmModal
          steps={[
            {
              title: 'Supprimer le projet ?',
              body: `Vous êtes sur le point de supprimer le projet "${projet.nom}". Cette action est irréversible.`,
              confirmLabel: 'Continuer',
              danger: false,
            },
            {
              title: 'Toutes les tâches seront perdues',
              body: `Le projet contient ${projet.activites.length} tâche${projet.activites.length !== 1 ? 's' : ''}. Elles seront définitivement supprimées avec le projet.`,
              confirmLabel: 'Je comprends, continuer',
              danger: true,
            },
            {
              title: 'Confirmation finale',
              body: `Dernière confirmation : supprimer définitivement le projet "${projet.nom}" et toutes ses tâches ?`,
              confirmLabel: 'Supprimer définitivement',
              danger: true,
            },
          ]}
          onConfirm={deleteProjet}
          onCancel={() => setDeleteProjetModal(false)}
        />
      )}

      {/* Modal suppression tâche — 1 étape */}
      {deleteActiviteId && (
        <ConfirmModal
          steps={[{
            title: 'Supprimer cette tâche ?',
            body: `La tâche "${projet.activites.find(a => a.id === deleteActiviteId)?.nom ?? ''}" sera définitivement supprimée.`,
            confirmLabel: 'Supprimer',
            danger: true,
          }]}
          onConfirm={() => deleteActivite(deleteActiviteId)}
          onCancel={() => setDeleteActiviteId(null)}
        />
      )}
    </div>
  )
}
