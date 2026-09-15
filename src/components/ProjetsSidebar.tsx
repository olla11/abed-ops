'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Lock, Zap, Users, Folder, X, Pencil, Trash2, Rocket, Lightbulb, Target, Leaf, FlaskConical, BarChart2, Palette, Trophy, BookOpen, Globe, Star, Briefcase, Plus, LayoutGrid, MoreVertical, GripVertical, type LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder, rocket: Rocket, lightbulb: Lightbulb, target: Target,
  zap: Zap, leaf: Leaf, flask: FlaskConical, chart: BarChart2,
  palette: Palette, trophy: Trophy, book: BookOpen, globe: Globe,
  star: Star, briefcase: Briefcase,
}
const ICON_OPTIONS = Object.keys(ICON_MAP)

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return `rgba(107,114,128,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}

// Badge circulaire teinté de la couleur de l'espace — identifie chaque
// espace au premier coup d'œil dans l'arborescence, comme un avatar
// d'espace de travail (Linear/Notion), au lieu d'une simple icône plate.
function EspaceIcon({ icon, size = 13, color = '#6b7280' }: { icon: string; size?: number; color?: string }) {
  const Icon = ICON_MAP[icon] ?? Folder
  return (
    <span style={{
      width: size + 12, height: size + 12, borderRadius: 7, flexShrink: 0,
      background: hexToRgba(color, .14), display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={size} color={color} strokeWidth={2} />
    </span>
  )
}

type Espace = { id: string; nom: string; couleur: string; icon: string; created_by?: string; ordre?: number | null }
type ProjetLite = { id: string; nom: string; is_public: boolean; espace_id: string | null; ordre?: number | null; activites: { id: string; statut: string; parent_id?: string | null }[] }
type Profile = { id: string; nom: string; prenoms: string }
type Membre = { id: string; profile_id: string; profile: Profile | null }

const COLOR_OPTIONS = ['#16a34a','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2','#be185d','#374151']

const menuItemStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
  background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12.5,
  fontWeight: 600, color: '#374151', textAlign: 'left',
}

function InitialsAvatar({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  const txt = `${profile.prenoms?.[0] ?? ''}${profile.nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--abed-green)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {txt}
    </div>
  )
}

export default function ProjetsSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [projets, setProjets] = useState<ProjetLite[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [membresPanel, setMembresPanel] = useState<string | null>(null) // espace id
  const [membres, setMembres] = useState<Record<string, Membre[]>>({})
  const [membreSearch, setMembreSearch] = useState('')
  const [addingMembre, setAddingMembre] = useState(false)
  const [showNewEspace, setShowNewEspace] = useState(false)
  const [newEspaceNom, setNewEspaceNom] = useState('')
  const [newEspaceCouleur, setNewEspaceCouleur] = useState('#16a34a')
  const [newEspaceIcon, setNewEspaceIcon] = useState('folder')
  const [showNewProjet, setShowNewProjet] = useState<string | null>(null)
  const [newProjetNom, setNewProjetNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [espaceErr, setEspaceErr] = useState('')
  const [projetErr, setProjetErr] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Rename state
  const [renamingEspace, setRenamingEspace] = useState<string | null>(null)
  const [renamingProjet, setRenamingProjet] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const [deleteEspaceId, setDeleteEspaceId] = useState<string | null>(null)
  const [deletingEspace, setDeletingEspace] = useState(false)
  // Menu d'actions (⋮) par espace
  const [openMenuEspace, setOpenMenuEspace] = useState<string | null>(null)
  // Glisser-déposer : réordonne les espaces entre eux, et les projets au
  // sein de leur propre groupe (un espace donné, ou "Autres projets") — pas
  // de déplacement entre groupes, un espace garde toujours ses projets.
  const [dragEspaceId, setDragEspaceId] = useState<string | null>(null)
  const [dragOverEspaceId, setDragOverEspaceId] = useState<string | null>(null)
  const [dragProjet, setDragProjet] = useState<{ id: string; groupKey: string } | null>(null)
  const [dragOverProjetId, setDragOverProjetId] = useState<string | null>(null)

  const load = useCallback(async (background = false) => {
    // On first load, restore from cache immediately to avoid flash
    if (!background) {
      try {
        const ce = sessionStorage.getItem('sidebar_espaces')
        const cp = sessionStorage.getItem('sidebar_projets')
        if (ce) setEspaces(JSON.parse(ce))
        if (cp) setProjets(JSON.parse(cp))
      } catch {}
    }
    const [re, rp, rpr] = await Promise.all([
      fetch('/api/espaces'),
      fetch('/api/projets'),
      fetch('/api/profiles'),
    ])
    const je = await re.json()
    const jp = await rp.json()
    const jpr = await rpr.json()
    if (je.data) {
      setEspaces(je.data)
      try { sessionStorage.setItem('sidebar_espaces', JSON.stringify(je.data)) } catch {}
    }
    if (jp.data) {
      setProjets(jp.data)
      try { sessionStorage.setItem('sidebar_projets', JSON.stringify(jp.data)) } catch {}
    }
    if (jpr.data) setAllProfiles(jpr.data)
  }, [])

  useEffect(() => { load() }, [load])

  // Get current user id from cookie/session via a lightweight call
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(j => { if (j.id) setCurrentUserId(j.id) }).catch(() => {})
  }, [])

  // Ferme le menu d'actions (⋮) d'un espace au clic ailleurs
  useEffect(() => {
    if (!openMenuEspace) return
    function onClick() { setOpenMenuEspace(null) }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [openMenuEspace])

  async function loadMembres(espaceId: string) {
    const r = await fetch(`/api/espaces/${espaceId}/membres`)
    const j = await r.json()
    if (j.data) setMembres(m => ({ ...m, [espaceId]: j.data }))
  }

  function toggleMembresPanel(espaceId: string) {
    if (membresPanel === espaceId) {
      setMembresPanel(null)
    } else {
      setMembresPanel(espaceId)
      setMembreSearch('')
      if (!membres[espaceId]) loadMembres(espaceId)
    }
  }

  async function addMembre(espaceId: string, profileId: string) {
    setAddingMembre(true)
    const r = await fetch(`/api/espaces/${espaceId}/membres`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    const j = await r.json()
    if (r.ok) {
      setMembres(m => ({ ...m, [espaceId]: [...(m[espaceId] ?? []), j.data] }))
      setMembreSearch('')
    }
    setAddingMembre(false)
  }

  async function removeMembre(espaceId: string, profileId: string) {
    const r = await fetch(`/api/espaces/${espaceId}/membres`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    if (r.ok) {
      setMembres(m => ({ ...m, [espaceId]: (m[espaceId] ?? []).filter(mb => mb.profile_id !== profileId) }))
    }
  }

  const activeId = pathname.startsWith('/projets/') ? pathname.split('/')[2] : null

  async function createEspace() {
    if (!newEspaceNom.trim()) return
    setEspaceErr('')
    setSaving(true)
    try {
      const r = await fetch('/api/espaces', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom: newEspaceNom.trim(), couleur: newEspaceCouleur, icon: newEspaceIcon }),
      })
      const j = await r.json()
      if (r.ok) {
        setEspaces(e => { const n = [...e, j.data]; try { sessionStorage.setItem('sidebar_espaces', JSON.stringify(n)) } catch {} return n })
        setNewEspaceNom('')
        setShowNewEspace(false)
      } else {
        setEspaceErr(j.error ?? 'Erreur lors de la création')
      }
    } catch {
      setEspaceErr('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function createProjet(espaceId: string | null) {
    if (!newProjetNom.trim()) return
    setProjetErr('')
    setSaving(true)
    try {
      const r = await fetch('/api/projets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom: newProjetNom.trim(), espace_id: espaceId }),
      })
      const j = await r.json()
      if (r.ok) {
        setProjets(p => { const n = [...p, { ...j.data, activites: [] }]; try { sessionStorage.setItem('sidebar_projets', JSON.stringify(n)) } catch {} return n })
        setNewProjetNom('')
        setShowNewProjet(null)
        router.push(`/projets/${j.data.id}`)
      } else {
        setProjetErr(j.error ?? 'Erreur lors de la création')
      }
    } catch {
      setProjetErr('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  function startRenameEspace(esp: Espace) {
    setRenamingEspace(esp.id)
    setRenameValue(esp.nom)
    setTimeout(() => renameRef.current?.select(), 30)
  }

  function startRenameProjet(p: ProjetLite) {
    setRenamingProjet(p.id)
    setRenameValue(p.nom)
    setTimeout(() => renameRef.current?.select(), 30)
  }

  async function deleteEspace(id: string) {
    setDeletingEspace(true)
    try {
      const r = await fetch(`/api/espaces/${id}`, { method: 'DELETE' })
      if (r.ok) {
        setEspaces(e => { const n = e.filter(x => x.id !== id); try { sessionStorage.setItem('sidebar_espaces', JSON.stringify(n)) } catch {} return n })
        setProjets(p => { const n = p.filter(x => x.espace_id !== id); try { sessionStorage.setItem('sidebar_projets', JSON.stringify(n)) } catch {} return n })
        setDeleteEspaceId(null)
      }
    } finally {
      setDeletingEspace(false)
    }
  }

  async function commitRenameEspace(id: string) {
    const val = renameValue.trim()
    if (!val) { setRenamingEspace(null); return }
    setEspaces(e => e.map(x => x.id === id ? { ...x, nom: val } : x))
    setRenamingEspace(null)
    await fetch(`/api/espaces/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: val }),
    })
  }

  async function commitRenameProjet(id: string) {
    const val = renameValue.trim()
    if (!val) { setRenamingProjet(null); return }
    setProjets(p => p.map(x => x.id === id ? { ...x, nom: val } : x))
    setRenamingProjet(null)
    await fetch(`/api/projets/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: val }),
    })
  }

  function projetsByEspace(eid: string | null) {
    // Tri stable : les projets déjà réordonnés (ordre non nul) d'abord dans
    // cet ordre, puis le reste dans son ordre d'arrivée (created_at, déjà
    // trié ainsi par l'API).
    return projets.filter(p => p.espace_id === eid).sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9))
  }

  const espacesTries = [...espaces].sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9))

  function reorderList<T extends { id: string }>(list: T[], draggedId: string, targetId: string): T[] {
    if (draggedId === targetId) return list
    const arr = [...list]
    const from = arr.findIndex(x => x.id === draggedId)
    const to = arr.findIndex(x => x.id === targetId)
    if (from === -1 || to === -1) return list
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    return arr
  }

  function dropEspace(targetId: string) {
    const draggedId = dragEspaceId
    setDragEspaceId(null); setDragOverEspaceId(null)
    if (!draggedId || draggedId === targetId) return
    const reordered = reorderList(espacesTries, draggedId, targetId).map((e, i) => ({ ...e, ordre: i }))
    setEspaces(prev => {
      const merged = prev.map(e => reordered.find(r => r.id === e.id) ?? e)
      try { sessionStorage.setItem('sidebar_espaces', JSON.stringify(merged)) } catch {}
      return merged
    })
    for (const e of reordered) {
      fetch(`/api/espaces/${e.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ordre: e.ordre }) }).catch(() => {})
    }
  }

  // Déplace un projet vers le groupe (espace, ou "aucun") du point de dépôt,
  // à la position voulue (avant beforeId, ou en dernier si null) — que ce
  // dépôt se fasse sur une autre ligne de projet (même groupe ou un groupe
  // différent : les deux à la fois réordonnent ET changent d'espace le cas
  // échéant) ou directement sur l'en-tête d'un espace.
  function moveProjetTo(projetId: string, targetEspaceId: string | null, beforeId: string | null) {
    setProjets(prev => {
      const moved = prev.find(p => p.id === projetId)
      if (!moved) return prev
      const movedUpdated = { ...moved, espace_id: targetEspaceId }
      const autresGroupes = prev.filter(p => p.id !== projetId && p.espace_id !== targetEspaceId)
      const memeGroupe = prev.filter(p => p.id !== projetId && p.espace_id === targetEspaceId)
        .sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9))
      const idx = beforeId ? memeGroupe.findIndex(p => p.id === beforeId) : -1
      const nouveauGroupe = idx === -1
        ? [...memeGroupe, movedUpdated]
        : [...memeGroupe.slice(0, idx), movedUpdated, ...memeGroupe.slice(idx)]
      const avecOrdre = nouveauGroupe.map((p, i) => ({ ...p, ordre: i }))
      const merged = [...autresGroupes, ...avecOrdre]
      try { sessionStorage.setItem('sidebar_projets', JSON.stringify(merged)) } catch {}

      const espaceChange = moved.espace_id !== targetEspaceId
      fetch(`/api/projets/${projetId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordre: avecOrdre.find(p => p.id === projetId)?.ordre, ...(espaceChange ? { espace_id: targetEspaceId } : {}) }),
      }).catch(() => {})
      for (const p of avecOrdre) {
        if (p.id === projetId) continue
        fetch(`/api/projets/${p.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ordre: p.ordre }) }).catch(() => {})
      }
      return merged
    })
  }

  function dropProjet(groupKey: string, targetId: string) {
    const dragged = dragProjet
    setDragProjet(null); setDragOverProjetId(null)
    if (!dragged || dragged.id === targetId) return
    moveProjetTo(dragged.id, groupKey === 'none' ? null : groupKey, targetId)
  }

  // Déposer un projet directement sur l'en-tête d'un espace (pas sur une
  // autre ligne de projet) le déplace en dernière position de ce groupe.
  function dropProjetOnEspaceHeader(targetEspaceId: string | null) {
    const dragged = dragProjet
    setDragProjet(null); setDragOverProjetId(null)
    if (!dragged) return
    moveProjetTo(dragged.id, targetEspaceId, null)
  }

  function renderProjet(p: ProjetLite, groupKey: string) {
    const isActive = p.id === activeId
    const topLevel = p.activites.filter(a => !a.parent_id)
    const done = topLevel.filter(a => a.statut === 'termine').length
    const total = topLevel.length
    const isRenaming = renamingProjet === p.id
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const isDragOver = dragOverProjetId === p.id && !!dragProjet && dragProjet.id !== p.id
    return (
      <div key={p.id} className="hub-row"
        draggable={!isRenaming}
        onDragStart={e => { e.stopPropagation(); setDragProjet({ id: p.id, groupKey }) }}
        onDragOver={e => { if (dragProjet) { e.preventDefault(); e.stopPropagation(); setDragOverProjetId(p.id) } }}
        onDragLeave={() => { if (dragOverProjetId === p.id) setDragOverProjetId(null) }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); dropProjet(groupKey, p.id) }}
        onDragEnd={() => { setDragProjet(null); setDragOverProjetId(null) }}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px 6px 34px',
          borderRadius: 7, cursor: 'pointer', margin: '1px 6px 1px 2px',
          background: isActive ? 'rgba(22,163,74,0.10)' : 'transparent',
          color: isActive ? '#15803d' : '#374151',
          boxShadow: isDragOver ? 'inset 0 2px 0 #16a34a' : 'none',
          opacity: dragProjet?.id === p.id ? .4 : 1,
        }}
        onClick={() => { if (!isRenaming) router.push(`/projets/${p.id}`) }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f0f1f3' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(22,163,74,0.10)' : 'transparent' }}>
        {/* Trait de liaison vertical — chaque ligne dessine son propre segment,
            l'ensemble forme un guide continu qui matérialise l'arborescence */}
        <span style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 1, background: '#e5e7eb' }} />
        <span className="rename-btn" style={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0, marginRight: -2 }} title="Glisser pour réordonner">
          <GripVertical size={11} color="#c3c8cf" strokeWidth={2} />
        </span>
        {p.is_public
          ? <Zap size={12} color="#d97706" strokeWidth={2} style={{ flexShrink: 0 }} />
          : <Lock size={11} color="#9ca3af" strokeWidth={2} style={{ flexShrink: 0 }} />}
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRenameProjet(p.id); if (e.key === 'Escape') setRenamingProjet(null) }}
            onBlur={() => commitRenameProjet(p.id)}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, border: '1px solid #16a34a', borderRadius: 4, padding: '1px 5px', outline: 'none', minWidth: 0 }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); startRenameProjet(p) }}
            style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title="Double-clic pour renommer"
          >{p.nom}</span>
        )}
        {!isRenaming && total > 0 && (
          <span title={`${done}/${total} tâches terminées`} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, position: 'relative', background: `conic-gradient(${isActive ? '#16a34a' : '#9ca3af'} ${pct * 3.6}deg, #e5e7eb 0deg)` }}>
              <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: isActive ? '#f0fdf4' : '#fafafa' }} />
            </span>
            <span style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 600 }}>{done}/{total}</span>
          </span>
        )}
        {!isRenaming && (
          <button
            onClick={e => { e.stopPropagation(); startRenameProjet(p) }}
            title="Renommer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            className="rename-btn"
          ><Pencil size={11} color="#9ca3af" strokeWidth={2} /></button>
        )}
      </div>
    )
  }

  function renderAddProjet(key: string, espaceId: string | null) {
    if (showNewProjet === key) {
      return (
        <div style={{ padding: '4px 8px 6px 34px', margin: '2px 6px 2px 2px' }}>
          <input autoFocus placeholder="Nom du projet…" value={newProjetNom}
            onChange={e => { setNewProjetNom(e.target.value); setProjetErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') createProjet(espaceId); if (e.key === 'Escape') { setShowNewProjet(null); setNewProjetNom(''); setProjetErr('') } }}
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: `1px solid ${projetErr ? '#dc2626' : '#16a34a'}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
          {projetErr && <p style={{ fontSize: 11, color: '#dc2626', margin: '3px 0 0' }}>{projetErr}</p>}
        </div>
      )
    }
    return (
      <div onClick={() => { setShowNewProjet(key); setNewProjetNom('') }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 34px', margin: '1px 6px 1px 2px', borderRadius: 7, cursor: 'pointer', color: '#9ca3af', fontSize: 12, fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#16a34a'; e.currentTarget.style.background = '#f0fdf4' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}>
        <Plus size={12} strokeWidth={2} color="currentColor" /> Ajouter un projet
      </div>
    )
  }

  function renderMembresPanel(esp: Espace) {
    const espMembres = membres[esp.id] ?? []
    const memberIds = new Set(espMembres.map(m => m.profile_id))
    const isCreator = esp.created_by === currentUserId

    const filteredProfiles = allProfiles.filter(p =>
      !memberIds.has(p.id) &&
      (membreSearch === '' ||
        `${p.prenoms} ${p.nom}`.toLowerCase().includes(membreSearch.toLowerCase()))
    )

    return (
      <div style={{ margin: '2px 6px 8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Membres de l&apos;espace</span>
          <button onClick={() => setMembresPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex', alignItems: 'center' }}><X size={12} color="currentColor" strokeWidth={1.5} /></button>
        </div>

        {/* Current members */}
        <div style={{ padding: '6px 0' }}>
          {espMembres.length === 0 && (
            <p style={{ fontSize: 12, color: '#9ca3af', padding: '4px 12px', margin: 0 }}>Aucun membre</p>
          )}
          {espMembres.map(mb => (
            <div key={mb.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px' }}>
              <InitialsAvatar profile={mb.profile} />
              <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>
                {mb.profile ? `${mb.profile.prenoms} ${mb.profile.nom}` : mb.profile_id}
              </span>
              {isCreator && mb.profile_id !== currentUserId && (
                <button onClick={() => removeMembre(esp.id, mb.profile_id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 12, padding: '0 2px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}><X size={11} color="currentColor" strokeWidth={1.5} /></button>
              )}
            </div>
          ))}
        </div>

        {/* Add member - only for creator */}
        {isCreator && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid #f3f4f6' }}>
            <input
              placeholder="Rechercher un membre…"
              value={membreSearch}
              onChange={e => setMembreSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
            {membreSearch && (
              <div style={{ marginTop: 4, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', maxHeight: 160, overflowY: 'auto' }}>
                {filteredProfiles.length === 0 && (
                  <p style={{ fontSize: 12, color: '#9ca3af', padding: '8px 10px', margin: 0 }}>Aucun résultat</p>
                )}
                {filteredProfiles.slice(0, 8).map(p => (
                  <div key={p.id}
                    onClick={() => !addingMembre && addMembre(esp.id, p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <InitialsAvatar profile={p} />
                    <span style={{ fontSize: 12 }}>{p.prenoms} {p.nom}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #e5e7eb', background: '#fafbfc', height: 'calc(100vh - 60px)', position: 'fixed', top: 60, left: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 150 }}>
      {/* Header — reste fixe pendant que la liste ci-dessous défile */}
      <div style={{ padding: '16px 12px 10px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <LayoutGrid size={13} color="#9ca3af" strokeWidth={2} /> Espaces
          </span>
          <button onClick={() => setShowNewEspace(v => !v)}
            title="Nouvel espace"
            style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: showNewEspace ? '#f0fdf4' : 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
              color: showNewEspace ? '#16a34a' : '#9ca3af',
            }}
            onMouseEnter={e => { if (!showNewEspace) { e.currentTarget.style.background = '#eef0f2'; e.currentTarget.style.color = '#374151' } }}
            onMouseLeave={e => { if (!showNewEspace) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af' } }}>
            <Plus size={15} strokeWidth={2.2} color="currentColor" />
          </button>
        </div>
        {showNewEspace && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Icône</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map(ic => {
                const Ic = ICON_MAP[ic]
                const active = newEspaceIcon === ic
                return (
                  <button key={ic} onClick={() => setNewEspaceIcon(ic)}
                    style={{ background: active ? hexToRgba(newEspaceCouleur, .14) : '#f9fafb', border: `1.5px solid ${active ? newEspaceCouleur : 'transparent'}`, borderRadius: 7, cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic size={14} color={active ? newEspaceCouleur : '#6b7280'} strokeWidth={2} />
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Couleur</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewEspaceCouleur(c)}
                  style={{ width: 19, height: 19, borderRadius: '50%', background: c, border: `2px solid ${newEspaceCouleur === c ? '#111827' : 'white'}`, boxShadow: newEspaceCouleur === c ? 'none' : '0 0 0 1px #e5e7eb', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
            <input autoFocus placeholder="Nom de l'espace…" value={newEspaceNom}
              onChange={e => setNewEspaceNom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createEspace(); if (e.key === 'Escape') setShowNewEspace(false) }}
              style={{ width: '100%', padding: '7px 9px', fontSize: 12.5, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            {espaceErr && <p style={{ fontSize: 11, color: '#dc2626', margin: '0 0 8px' }}>{espaceErr}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={createEspace} disabled={saving || !newEspaceNom.trim()}
                style={{ flex: 1, padding: '6px 0', background: saving ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Création…' : 'Créer'}
              </button>
              <button onClick={() => { setShowNewEspace(false); setEspaceErr('') }}
                style={{ padding: '6px 9px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={12} color="#6b7280" strokeWidth={2} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Espaces list — seule cette zone défile, l'en-tête reste visible */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {espacesTries.map(esp => {
          const isCollapsed = collapsed[esp.id] ?? false
          const espProjets = projetsByEspace(esp.id)
          const espMembres = membres[esp.id]
          const membresCount = espMembres?.length ?? null

          const isDragOverEspace = dragOverEspaceId === esp.id && dragEspaceId !== esp.id
          const menuOpen = openMenuEspace === esp.id
          const isOwner = esp.created_by === currentUserId

          return (
            <div key={esp.id} style={{ marginBottom: 2 }}>
              <div
                draggable={renamingEspace !== esp.id}
                onDragStart={e => { e.stopPropagation(); setDragEspaceId(esp.id) }}
                onDragOver={e => { if (dragEspaceId) { e.preventDefault(); setDragOverEspaceId(esp.id) } else if (dragProjet) { e.preventDefault() } }}
                onDragLeave={() => { if (dragOverEspaceId === esp.id) setDragOverEspaceId(null) }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragEspaceId) dropEspace(esp.id)
                  else if (dragProjet) dropProjetOnEspaceHeader(esp.id)
                }}
                onDragEnd={() => { setDragEspaceId(null); setDragOverEspaceId(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', cursor: 'pointer', margin: '1px 6px', borderRadius: 7,
                  boxShadow: isDragOverEspace ? 'inset 0 2px 0 #16a34a' : 'none', opacity: dragEspaceId === esp.id ? .4 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f1f3')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0 }} title="Glisser pour réordonner">
                  <GripVertical size={11} color="#c3c8cf" strokeWidth={2} />
                </span>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, flexShrink: 0 }}>
                  <ChevronDown size={11} color="#9ca3af" strokeWidth={2} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                </span>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}><EspaceIcon icon={esp.icon} color={esp.couleur} /></span>
                {renamingEspace === esp.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRenameEspace(esp.id); if (e.key === 'Escape') setRenamingEspace(null) }}
                    onBlur={() => commitRenameEspace(esp.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 13, fontWeight: 700, border: '1px solid #16a34a', borderRadius: 4, padding: '1px 5px', outline: 'none', minWidth: 0 }}
                  />
                ) : (
                  // Nom complet, sans troncature — quitte à passer à la ligne
                  // pour un nom long, plutôt que de couper l'information.
                  <span
                    onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                    onDoubleClick={e => { e.stopPropagation(); startRenameEspace(esp) }}
                    style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, letterSpacing: '-.01em' }}
                    title="Double-clic pour renommer"
                  >{esp.nom}</span>
                )}
                {renamingEspace !== esp.id && (
                  <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                    style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', background: '#eef0f2', borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{espProjets.length}</span>
                )}
                {/* Toutes les actions (renommer, membres, supprimer) rangées
                    dans un menu ⋮ — pour ne pas surcharger la ligne et
                    laisser toute la place au nom de l'espace. */}
                {renamingEspace !== esp.id && (
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setOpenMenuEspace(m => m === esp.id ? null : esp.id) }}
                      title="Actions"
                      style={{
                        background: menuOpen ? '#e5e7eb' : 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 5,
                        display: 'flex', alignItems: 'center', color: menuOpen ? '#374151' : '#9ca3af',
                      }}
                      onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#e5e7eb' } }}
                      onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none' } }}>
                      <MoreVertical size={13} strokeWidth={2} color="currentColor" />
                    </button>
                    {menuOpen && (
                      <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white',
                        border: '1px solid #e5e7eb', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                        minWidth: 172, zIndex: 200, overflow: 'hidden', padding: 4,
                      }}>
                        <button onClick={() => { startRenameEspace(esp); setOpenMenuEspace(null) }}
                          style={menuItemStyle}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <Pencil size={13} strokeWidth={2} /> Renommer
                        </button>
                        <button onClick={() => { toggleMembresPanel(esp.id); setOpenMenuEspace(null) }}
                          style={menuItemStyle}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <Users size={13} strokeWidth={2} /> Gérer les membres{membresCount !== null ? ` (${membresCount})` : ''}
                        </button>
                        {isOwner && (
                          <button onClick={() => { setDeleteEspaceId(esp.id); setOpenMenuEspace(null) }}
                            style={{ ...menuItemStyle, color: '#dc2626' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <Trash2 size={13} strokeWidth={2} /> Supprimer l&apos;espace
                          </button>
                        )}
                      </div>
                    )}
                  </span>
                )}
              </div>

              {/* Members panel */}
              {membresPanel === esp.id && renderMembresPanel(esp)}

              {!isCollapsed && (
                <>
                  {espProjets.map(p => renderProjet(p, esp.id))}
                  {renderAddProjet(esp.id, esp.id)}
                </>
              )}
            </div>
          )
        })}

        {/* Projects without espace */}
        {(() => {
          const noProjets = projetsByEspace(null)
          if (noProjets.length === 0 && espaces.length > 0) return null
          const key = 'none'
          const isCollapsed = collapsed[key] ?? false
          return (
            <div style={{ marginTop: espaces.length > 0 ? 6 : 0 }}>
              {espaces.length > 0 && <div style={{ height: 1, background: '#eef0f2', margin: '6px 14px 8px' }} />}
              <div onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
                onDragOver={e => { if (dragProjet) e.preventDefault() }}
                onDrop={e => { e.preventDefault(); if (dragProjet) dropProjetOnEspaceHeader(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', cursor: 'pointer', margin: '1px 6px', borderRadius: 7 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f1f3')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, flexShrink: 0 }}>
                  <ChevronDown size={11} color="#9ca3af" strokeWidth={2} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                </span>
                <span style={{ width: 25, height: 25, borderRadius: 7, background: '#eef0f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Folder size={13} color="#6b7280" strokeWidth={2} />
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-.01em' }}>Autres projets</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', background: '#eef0f2', borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{noProjets.length}</span>
              </div>
              {!isCollapsed && (
                <>
                  {noProjets.map(p => renderProjet(p, 'none'))}
                  {renderAddProjet(key, null)}
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* Confirm delete espace */}
      {deleteEspaceId && (() => {
        const esp = espaces.find(e => e.id === deleteEspaceId)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setDeleteEspaceId(null)}>
            <div style={{ background: 'white', borderRadius: 14, padding: '24px 22px', width: 340, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#111827', margin: '0 0 8px' }}>Supprimer l&apos;espace ?</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px', lineHeight: 1.5 }}>
                L&apos;espace <strong>&quot;{esp?.nom}&quot;</strong> sera supprimé. Les projets qu&apos;il contient seront déliés mais pas supprimés.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteEspaceId(null)}
                  style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={() => deleteEspace(deleteEspaceId)} disabled={deletingEspace}
                  style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {deletingEspace ? '…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
