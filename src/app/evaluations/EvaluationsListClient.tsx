'use client'
import Link from 'next/link'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

const PAGE_SIZE = 10

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:           { label: 'En attente',          color: '#92400e', bg: '#fffbeb' },
  evaluateur_complete:  { label: 'Évaluateur complété', color: '#1e40af', bg: '#eff6ff' },
  evalue_complete:      { label: 'À commenter',         color: '#6b21a8', bg: '#faf5ff' },
  responsable_complete: { label: 'Responsable signé',   color: '#92400e', bg: '#fffbeb' },
  cloture:              { label: 'Clôturé',             color: '#166534', bg: '#f0fdf4' },
}

type Evaluation = {
  id: string
  statut: string
  declenchee_le: string | null
  score_moyen: number | null
  contrat: { type_contrat: string; date_fin: string | null; poste: string | null } | null
}

export default function EvaluationsListClient({ evaluations }: { evaluations: Evaluation[] }) {
  const [page, setPage] = useState(1)
  const paged = paginate(evaluations, page, PAGE_SIZE)

  if (evaluations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
        Aucune évaluation pour le moment.
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {paged.map((e) => {
          const s = STATUTS[e.statut] ?? { label: e.statut, color: '#6b7280', bg: '#f3f4f6' }
          return (
            <div key={e.id} style={{
              background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10,
              padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {e.contrat?.poste ?? 'Poste N/A'} — {e.contrat?.type_contrat ?? ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 4 }}>
                  Fin contrat : {e.contrat?.date_fin ?? 'N/A'} · Déclenchée le : {e.declenchee_le ? new Date(e.declenchee_le).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {e.score_moyen != null && (
                  <span style={{ fontWeight: 700, color: 'var(--abed-green)' }}>{Number(e.score_moyen).toFixed(1)}/5</span>
                )}
                <span style={{
                  background: s.bg, color: s.color,
                  borderRadius: 6, padding: '3px 12px', fontSize: 12, fontWeight: 600,
                }}>
                  {s.label}
                </span>
                <Link href={`/evaluations/${e.id}`} style={{
                  padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
                }}>
                  Ouvrir →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
      <Pagination page={page} total={evaluations.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  )
}
