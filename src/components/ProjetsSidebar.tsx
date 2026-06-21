'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type Espace = { id: string; nom: string; couleur: string; icon: string; created_by?: string }
type ProjetLite = { id: string; nom: string; is_public: boolean; espace_id: string | null; activites: { id: string; statut: string }[] }
type Profile = { id: string; nom: string; prenoms: string }
type Membre = { id: string; profile_id: string; profile: Profile | null }

const ICON_OPTIONS = ['📁','🚀','💡','🎯','⚡','🌱','🔬','📊','🎨','🏆']
const COLOR_OPTIONS = ['#16a34a','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2','#be185d','#374151']

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
  const [newEspaceIcon, setNewEspaceIcon] = useState('📁')
  const [showNewProjet, setShowNewProjet] = useState<string | null>(null)
  const [newProjetNom, setNewProjetNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [espaceErr, setEspaceErr] = useState('')
  const [projetErr, setProjetErr] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [re, rp, rpr] = await Promise.all([
      fetch('/api/espaces'),
      fetch('/api/projets'),
      fetch('/api/profiles'),
    ])
    const je = await re.json()
    const jp = await rp.json()
    const jpr = await rpr.json()
    if (je.data) setEspaces(je.data)
    if (jp.data) setProjets(jp.data)
    if (jpr.data) setAllProfiles(jpr.data)
  }, [])

  useEffect(() => { load() }, [load])

  // Get current user id from cookie/session via a lightweight call
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(j => { if (j.id) setCurrentUserId(j.id) }).catch(() => {})
  }, [])

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
        setEspaces(e => [...e, j.data])
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
        setProjets(p => [...p, { ...j.data, activites: [] }])
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

  function projetsByEspace(eid: string | null) {
    return projets.filter(p => p.espace_id === eid)
  }

  function renderProjet(p: ProjetLite) {
    const isActive = p.id === activeId
    const done = p.activites.filter(a => a.statut === 'termine').length
    const total = p.activites.length
    return (
      <div key={p.id}
        onClick={() => router.push(`/projets/${p.id}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 24px',
          borderRadius: 6, cursor: 'pointer', margin: '1px 4px',
          background: isActive ? 'rgba(22,163,74,0.12)' : 'transparent',
          color: isActive ? '#16a34a' : '#374151',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(22,163,74,0.12)' : 'transparent' }}>
        <span style={{ fontSize: 11 }}>{p.is_public ? '⚡' : '🔒'}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
        {total > 0 && <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{done}/{total}</span>}
      </div>
    )
  }

  function renderAddProjet(key: string, espaceId: string | null) {
    if (showNewProjet === key) {
      return (
        <div style={{ padding: '4px 8px 4px 24px', margin: '2px 4px' }}>
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
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 24px', margin: '1px 4px', borderRadius: 6, cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#16a34a'; e.currentTarget.style.background = '#f3f4f6' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }}>
        + Ajouter un projet
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
      <div style={{ margin: '0 8px 8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Membres de l&apos;espace</span>
          <button onClick={() => setMembresPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: 0 }}>✕</button>
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
                  onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>✕</button>
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
    <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #e5e7eb', background: '#fafafa', height: 'calc(100vh - 60px)', position: 'fixed', top: 60, left: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* Header */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>Espaces</span>
          <button onClick={() => setShowNewEspace(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', padding: 0, lineHeight: 1 }}
            title="Nouvel espace">+</button>
        </div>
        {showNewEspace && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map(ic => (
                <button key={ic} onClick={() => setNewEspaceIcon(ic)}
                  style={{ fontSize: 14, background: newEspaceIcon === ic ? '#f0fdf4' : 'none', border: `1px solid ${newEspaceIcon === ic ? '#16a34a' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', padding: '2px 4px' }}>{ic}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewEspaceCouleur(c)}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: `2px solid ${newEspaceCouleur === c ? '#111827' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
            <input autoFocus placeholder="Nom de l'espace…" value={newEspaceNom}
              onChange={e => setNewEspaceNom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createEspace(); if (e.key === 'Escape') setShowNewEspace(false) }}
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
            {espaceErr && <p style={{ fontSize: 11, color: '#dc2626', margin: '0 0 6px' }}>{espaceErr}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={createEspace} disabled={saving || !newEspaceNom.trim()}
                style={{ flex: 1, padding: '5px 0', background: saving ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Création…' : 'Créer'}
              </button>
              <button onClick={() => { setShowNewEspace(false); setEspaceErr('') }}
                style={{ padding: '5px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Espaces list */}
      <div style={{ flex: 1, padding: '8px 0' }}>
        {espaces.map(esp => {
          const isCollapsed = collapsed[esp.id] ?? false
          const espProjets = projetsByEspace(esp.id)
          const espMembres = membres[esp.id]
          const membresCount = espMembres?.length ?? null

          return (
            <div key={esp.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', margin: '1px 4px', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                  style={{ fontSize: 9, color: '#9ca3af', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>▼</span>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))} style={{ fontSize: 15 }}>{esp.icon}</span>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{esp.nom}</span>
                {/* Members button */}
                <button onClick={e => { e.stopPropagation(); toggleMembresPanel(esp.id) }}
                  title="Gérer les membres"
                  style={{
                    background: membresPanel === esp.id ? '#f0fdf4' : 'none',
                    border: 'none', cursor: 'pointer', fontSize: 11,
                    color: membresPanel === esp.id ? '#16a34a' : '#9ca3af',
                    padding: '1px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (membresPanel !== esp.id) e.currentTarget.style.color = '#374151' }}
                  onMouseLeave={e => { if (membresPanel !== esp.id) e.currentTarget.style.color = '#9ca3af' }}>
                  👥{membresCount !== null ? ` ${membresCount}` : ''}
                </button>
                <span onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                  style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>{espProjets.length}</span>
              </div>

              {/* Members panel */}
              {membresPanel === esp.id && renderMembresPanel(esp)}

              {!isCollapsed && (
                <>
                  {espProjets.map(renderProjet)}
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
            <div>
              <div onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', margin: '1px 4px', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 9, color: '#9ca3af', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                <span style={{ fontSize: 15 }}>📋</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>Projets</span>
                <span style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 6px' }}>{noProjets.length}</span>
              </div>
              {!isCollapsed && (
                <>
                  {noProjets.map(renderProjet)}
                  {renderAddProjet(key, null)}
                </>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
