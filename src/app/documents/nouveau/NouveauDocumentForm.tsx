'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NouveauDocumentForm() {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function creer() {
    if (!titre.trim()) { setErr('Le titre est requis.'); return }
    if (!fichier) { setErr('Choisissez un fichier .docx ou .pdf.'); return }
    setSaving(true); setErr('')

    const fd = new FormData()
    fd.append('titre', titre.trim())
    if (description.trim()) fd.append('description', description.trim())
    fd.append('fichier', fichier)

    const res = await fetch('/api/documents', { method: 'POST', body: fd })
    setSaving(false)
    if (res.ok) {
      const j = await res.json()
      router.push(`/documents/${j.data.id}`)
    } else {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? 'Erreur')
    }
  }

  return (
    <div className="card">
      <div className="field">
        <label className="label">Titre *</label>
        <input className="input" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Rapport trimestriel Q3" />
      </div>
      <div className="field">
        <label className="label">Description (optionnel)</label>
        <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Fichier (.docx ou .pdf) *</label>
        <input type="file" accept=".docx,.pdf" onChange={e => setFichier(e.target.files?.[0] ?? null)} />
      </div>
      {err && <div style={{ color: '#c0392b', fontSize: 13, margin: '10px 0' }}>{err}</div>}
      <button className="btn" disabled={saving} onClick={creer} style={{ marginTop: 14 }}>
        {saving ? 'Conversion et création…' : 'Créer et ouvrir la révision'}
      </button>
    </div>
  )
}
