'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'

type Document = {
  id: string; titre: string; description: string | null; statut: string; created_at: string
  createur: { id: string; nom: string; prenoms: string } | null
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  revision: 'En révision',
  en_attente: 'En signature',
  complete: 'Terminé',
  refusee: 'Refusé',
}
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: '#f3f4f6', color: '#6b7280' },
  revision: { bg: '#eff6ff', color: '#2563eb' },
  en_attente: { bg: '#fffbeb', color: '#92400e' },
  complete: { bg: '#f0fdf4', color: '#16a34a' },
  refusee: { bg: '#fef2f2', color: '#dc2626' },
}

export default function DocumentsListClient({ documents, myId }: { documents: Document[]; myId: string }) {
  const router = useRouter()
  const [supprimantId, setSupprimantId] = useState<string | null>(null)

  async function supprimer(e: React.MouseEvent, doc: Document) {
    e.stopPropagation()
    if (!confirm(`Supprimer définitivement « ${doc.titre} » ? Cette action est irréversible et effacera aussi les commentaires et participants associés.`)) return
    setSupprimantId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(body?.error ?? 'Échec de la suppression.')
        return
      }
      router.refresh()
    } finally {
      setSupprimantId(null)
    }
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Documents</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Révision collaborative (commentaires, édition en direct) puis signature d&apos;un document.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/documents/nouveau" style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'var(--abed-green)', color: 'white', border: 'none', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <Plus size={15} /> Nouveau document
          </Link>
        </div>
      </div>

      {documents.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 24 }}>
          <FileText size={32} style={{ marginBottom: 10 }} />
          <div>Aucun document en révision pour le moment.</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Créé par</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map(d => {
                const c = STATUT_COLORS[d.statut] ?? STATUT_COLORS.brouillon
                const estCreateur = d.createur?.id === myId
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/documents/${d.id}`)}>
                    <td style={{ fontWeight: 600 }}>{d.titre}</td>
                    <td style={{ fontSize: 13 }}>{d.createur ? `${d.createur.prenoms} ${d.createur.nom}` : '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                        {STATUT_LABELS[d.statut] ?? d.statut}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    <td style={{ width: 36 }}>
                      {estCreateur && (
                        <button
                          type="button"
                          onClick={e => supprimer(e, d)}
                          disabled={supprimantId === d.id}
                          title="Supprimer le document"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
                            borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                            cursor: supprimantId === d.id ? 'wait' : 'pointer', opacity: supprimantId === d.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
