'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type Espace = { id: string; nom: string; couleur: string; icon: string }
type ProjetLite = { id: string; nom: string; is_public: boolean; espace_id: string | null; activites: { id: string; statut: string }[] }

const ICON_OPTIONS = ['📁','🚀','💡','🎯','⚡','🌱','🔬','📊','🎨','🏆']
const COLOR_OPTIONS = ['#16a34a','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2','#be185d','#374151']

export default function ProjetsSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [projets, setProjets] = useState<ProjetLite[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showNewEspace, setShowNewEspace] = useState(false)
  const [newEspaceNom, setNewEspaceNom] = useState('')
  const [newEspaceCouleur, setNewEspaceCouleur] = useState('#16a34a')
  const [newEspaceIcon, setNewEspaceIcon] = useState('📁')
  const [showNewProjet, setShowNewProjet] = useState<string | null>(null) // espace_id or 'none'
  const [newProjetNom, setNewProjetNom] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [re, rp] = await Promise.all([
      fetch('/api/espaces'),
      fetch('/api/projets'),
    ])
    const je = await re.json()
    const jp = await rp.json()
    if (je.data) setEspaces(je.data)
    if (jp.data) setProjets(jp.data)
  }, [])

  useEffect(() => { load() }, [load])

  const activeId = pathname.startsWith('/projets/') ? pathname.split('/')[2] : null

  async function createEspace() {
    if (!newEspaceNom.trim()) return
    setSaving(true)
    const r = await fetch('/api/espaces', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: newEspaceNom.trim(), couleur: newEspaceCouleur, icon: newEspaceIcon }),
    })
    const j = await r.json()
    if (r.ok) {
      setEspaces(e => [...e, j.data])
      setNewEspaceNom(''); setShowNewEspace(false)
    }
    setSaving(false)
  }

  async function createProjet(espaceId: string | null) {
    if (!newProjetNom.trim()) return
    setSaving(true)
    const r = await fetch('/api/projets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: newProjetNom.trim(), espace_id: espaceId }),
    })
    const j = await r.json()
    if (r.ok) {
      setProjets(p => [...p, { ...j.data, activites: [] }])
      setNewProjetNom(''); setShowNewProjet(null)
      router.push(`/projets/${j.data.id}`)
    }
    setSaving(false)
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
        {total > 0 && (
          <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{done}/{total}</span>
        )}
      </div>
    )
  }

  function renderAddProjet(key: string, espaceId: string | null) {
    if (showNewProjet === key) {
      return (
        <div style={{ padding: '4px 8px 4px 24px', margin: '2px 4px' }}>
          <input autoFocus
            placeholder="Nom du projet…" value={newProjetNom}
            onChange={e => setNewProjetNom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProjet(espaceId); if (e.key === 'Escape') { setShowNewProjet(null); setNewProjetNom('') } }}
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #16a34a', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={createEspace} disabled={saving || !newEspaceNom.trim()}
                style={{ flex: 1, padding: '5px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Créer
              </button>
              <button onClick={() => setShowNewEspace(false)}
                style={{ padding: '5px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '8px 0' }}>
        {/* Espaces with their projects */}
        {espaces.map(esp => {
          const isCollapsed = collapsed[esp.id] ?? false
          const espProjets = projetsByEspace(esp.id)
          return (
            <div key={esp.id}>
              <div
                onClick={() => setCollapsed(c => ({ ...c, [esp.id]: !c[esp.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', margin: '1px 4px', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 9, color: '#9ca3af', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>▼</span>
                <span style={{ fontSize: 15 }}>{esp.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{esp.nom}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', background: '#e5e7eb', borderRadius: 999, padding: '1px 6px' }}>{espProjets.length}</span>
              </div>
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
              <div
                onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
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
