'use client'
import { useState } from 'react'

type Resultat = { fichier: string; ok: boolean; error?: string }

export default function BackfillBcPdfClient() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [resultats, setResultats] = useState<Resultat[] | null>(null)

  async function envoyer() {
    if (files.length === 0) return
    setLoading(true); setResultats(null)
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    const res = await fetch('/api/admin/backfill-bc-pdf', { method: 'POST', body: form })
    const json = await res.json()
    setResultats(json.results ?? [{ fichier: '—', ok: false, error: json.error ?? 'Erreur inconnue' }])
    setLoading(false)
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 8 }}>Remplacer les PDF des bons de commande historiques</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Outil ponctuel. Sélectionnez les fichiers PDF nommés <code>BC001-26.pdf</code>, <code>BC002-26.pdf</code>, etc.
        — le numéro de bon de commande correspondant est retrouvé automatiquement à partir du nom du fichier.
      </p>

      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={e => setFiles(Array.from(e.target.files ?? []))}
        style={{ marginBottom: 16 }}
      />

      {files.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
          {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''} : {files.map(f => f.name).join(', ')}
        </p>
      )}

      <button className="btn" onClick={envoyer} disabled={loading || files.length === 0}>
        {loading ? 'Envoi…' : `Téléverser ${files.length || ''}`.trim()}
      </button>

      {resultats && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {resultats.map((r, i) => (
            <div key={i} style={{
              fontSize: 13, padding: '8px 12px', borderRadius: 8,
              background: r.ok ? '#dcfce7' : '#fee2e2', color: r.ok ? '#166534' : '#991b1b',
            }}>
              {r.ok ? '✓' : '✗'} {r.fichier} {r.error ? `— ${r.error}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
