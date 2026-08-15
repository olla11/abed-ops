'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, PenLine } from 'lucide-react'

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
          <Link href="/signatures" style={{
            padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'white', color: '#374151', border: '1px solid var(--abed-border)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <PenLine size={15} /> Signature directe
          </Link>
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
              </tr>
            </thead>
            <tbody>
              {documents.map(d => {
                const c = STATUT_COLORS[d.statut] ?? STATUT_COLORS.brouillon
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
