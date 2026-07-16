'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NouveauTdrForm() {
  const router = useRouter()
  const [titreActivite, setTitreActivite] = useState('')
  const [projet, setProjet] = useState('')
  const [periode, setPeriode] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titreActivite.trim()) { setErr('Le titre de l\'activité est requis.'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/tdrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre_activite: titreActivite.trim(), projet: projet.trim(), periode: periode.trim() }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      router.push(`/tdr/${data.data.id}`)
    } else {
      setErr(data.error ?? 'Erreur lors de la création')
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Titre de l&apos;activité *</label>
        <input className="input" value={titreActivite} onChange={e => setTitreActivite(e.target.value)}
          placeholder="Ex : Programme d'accélération de la mise à échelle des aliments nutritifs..." required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="label">Projet</label>
        <input className="input" value={projet} onChange={e => setProjet(e.target.value)} placeholder="Ex : INPME" />
      </div>
      <div className="field" style={{ marginBottom: 18 }}>
        <label className="label">Date / Période</label>
        <input className="input" value={periode} onChange={e => setPeriode(e.target.value)} placeholder="Ex : Juillet à octobre 2026" />
      </div>
      {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{err}</div>}
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Le TDR sera créé avec les 8 chapitres standards à compléter (Contexte, Objectifs, Résultats,
        Méthodologie, Chronogramme, Acteurs, Communication, Budget). Le CAF et le Directeur Exécutif
        sont automatiquement ajoutés comme signataires.
      </p>
      <button className="btn" disabled={saving}>{saving ? 'Création…' : 'Créer le TDR'}</button>
    </form>
  )
}
