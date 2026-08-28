'use client'
import { useEffect, useState } from 'react'
import { FileText, GraduationCap, IdCard, Paperclip, Upload, Trash2, Loader2 } from 'lucide-react'

type Doc = {
  id: string
  categorie: 'cv' | 'diplome' | 'piece_identite' | 'autre'
  nom_fichier: string
  storage_path: string
  uploaded_by: string
  created_at: string
}

const CATEGORIES: { key: Doc['categorie']; label: string; icon: React.ElementType }[] = [
  { key: 'cv', label: 'CV', icon: FileText },
  { key: 'diplome', label: 'Diplômes', icon: GraduationCap },
  { key: 'piece_identite', label: "Pièce d'identité", icon: IdCard },
  { key: 'autre', label: 'Autre', icon: Paperclip },
]

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=dossiers-personnel&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert("Impossible d'ouvrir : " + (json.error ?? 'erreur'))
}

export default function PersonnelDossierClient({ profileId, canDelete }: { profileId: string; canDelete: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [categorie, setCategorie] = useState<Doc['categorie']>('cv')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  function load() {
    setLoading(true)
    fetch(`/api/personnel-documents?profileId=${profileId}`)
      .then(r => r.json())
      .then(j => setDocs(j.data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [profileId])

  async function upload() {
    if (!file) return
    setUploading(true); setErr('')
    const form = new FormData()
    form.append('profileId', profileId)
    form.append('categorie', categorie)
    form.append('file', file)
    const res = await fetch('/api/personnel-documents', { method: 'POST', body: form })
    const json = await res.json()
    setUploading(false)
    if (res.ok) { setFile(null); load() }
    else setErr(json.error ?? 'Erreur lors du dépôt')
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce document ?')) return
    const res = await fetch(`/api/personnel-documents/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Erreur lors de la suppression')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={categorie} onChange={e => setCategorie(e.target.value as Doc['categorie'])}
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--abed-border)' }}>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
        <button onClick={upload} disabled={!file || uploading} className="btn" style={{
          fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (!file || uploading) ? 0.6 : 1,
        }}>
          {uploading ? <Loader2 size={15} /> : <Upload size={15} />}
          {uploading ? 'Envoi…' : 'Ajouter'}
        </button>
      </div>
      {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 16 }}>{err}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {CATEGORIES.map(c => {
            const items = docs.filter(d => d.categorie === c.key)
            return (
              <div key={c.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <c.icon size={16} strokeWidth={2} color="var(--abed-green)" />
                  <strong style={{ fontSize: 13 }}>{c.label}</strong>
                </div>
                {items.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 24 }}>Aucun document.</p>
                ) : (
                  <ul style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, marginLeft: 24 }}>
                    {items.map(d => (
                      <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => openFile(d.storage_path)}>
                          {d.nom_fichier}
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                          {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        {canDelete && (
                          <button onClick={() => remove(d.id)} title="Supprimer" style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-danger)', display: 'flex',
                          }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
