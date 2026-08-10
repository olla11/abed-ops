'use client'
import { useEffect, useState } from 'react'
import { TITRE_LABELS, type Titre } from '@/lib/roles'

type Holder = { id: string; nom: string; prenoms: string }
type Doublon = { titre: string; holders: Holder[]; profile_id_principal: string | null; defini_le: string | null }

export default function TitresPrincipauxAlert() {
  const [doublons, setDoublons] = useState<Doublon[] | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    const res = await fetch('/api/admin/titres-principaux')
    if (res.ok) {
      const data = await res.json()
      setDoublons(data.doublons ?? [])
    }
  }

  useEffect(() => { load() }, [])

  async function basculer(titre: string, profile_id: string) {
    setSaving(titre)
    setErr('')
    try {
      const res = await fetch('/api/admin/titres-principaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, profile_id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error ?? 'Erreur')
      } else {
        await load()
      }
    } finally {
      setSaving(null)
    }
  }

  if (!doublons || doublons.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      {doublons.map(d => (
        <div key={d.titre} style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '14px 18px',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#92400e' }}>
            ⚠️ <strong>{TITRE_LABELS[d.titre as Titre] ?? d.titre}</strong> est porté par {d.holders.length} comptes actifs.
            Choisissez le titulaire <strong>principal</strong> — son nom sera utilisé officiellement partout (circuits, documents),
            et les dossiers déjà en attente de ce rôle lui seront réattribués.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {d.holders.map(h => {
              const estPrincipal = h.id === d.profile_id_principal
              return (
                <button
                  key={h.id}
                  disabled={estPrincipal || saving === d.titre}
                  onClick={() => basculer(d.titre, h.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 13,
                    border: estPrincipal ? '1px solid var(--abed-green)' : '1px solid #d1d5db',
                    background: estPrincipal ? 'var(--abed-green)' : 'white',
                    color: estPrincipal ? 'white' : '#374151',
                    fontWeight: estPrincipal ? 700 : 500,
                    cursor: estPrincipal ? 'default' : 'pointer',
                    opacity: saving === d.titre && !estPrincipal ? 0.6 : 1,
                  }}
                >
                  {estPrincipal ? '★ ' : ''}{h.prenoms} {h.nom}{estPrincipal ? ' (principal)' : ''}
                </button>
              )
            })}
          </div>
          {err && saving === null && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err}</p>}
        </div>
      ))}
    </div>
  )
}
