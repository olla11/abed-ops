'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Upload } from 'lucide-react'

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 12px',
  borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 700,
  border: active ? '2px solid var(--abed-green)' : '1px solid var(--abed-border)',
  background: active ? '#f0fdf4' : 'white', color: active ? 'var(--abed-green)' : '#374151',
})

export default function NouveauDocumentForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'vierge' | 'import'>('vierge')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function creer() {
    if (!titre.trim()) { setErr('Le titre est requis.'); return }
    if (mode === 'import' && !fichier) { setErr('Choisissez un fichier .docx.'); return }
    setSaving(true); setErr('')

    const fd = new FormData()
    fd.append('titre', titre.trim())
    if (description.trim()) fd.append('description', description.trim())
    if (mode === 'import' && fichier) fd.append('fichier', fichier)

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
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button type="button" style={modeBtnStyle(mode === 'vierge')} onClick={() => setMode('vierge')}>
          <FilePlus2 size={20} />
          Document vierge
        </button>
        <button type="button" style={modeBtnStyle(mode === 'import')} onClick={() => setMode('import')}>
          <Upload size={20} />
          Importer un Word
        </button>
      </div>

      <div className="field">
        <label className="label">Titre *</label>
        <input className="input" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Rapport trimestriel Q3" />
      </div>
      <div className="field">
        <label className="label">Description (optionnel)</label>
        <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      {mode === 'import' && (
        <div className="field">
          <label className="label">Fichier (.docx) *</label>
          <input type="file" accept=".docx" onChange={e => setFichier(e.target.files?.[0] ?? null)} />
        </div>
      )}
      {err && <div style={{ color: '#c0392b', fontSize: 13, margin: '10px 0' }}>{err}</div>}
      <button className="btn" disabled={saving} onClick={creer} style={{ marginTop: 14 }}>
        {saving ? 'Création…' : mode === 'vierge' ? 'Créer et rédiger' : 'Créer et ouvrir la révision'}
      </button>
    </div>
  )
}
