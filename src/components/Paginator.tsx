'use client'

type Props = {
  page: number
  total: number
  perPage: number
  onChange: (p: number) => void
}

export default function Paginator({ page, total, perPage, onChange }: Props) {
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, marginTop: 16, paddingTop: 14,
      borderTop: '1px solid var(--abed-border)',
    }}>
      <button
        className="btn secondary"
        style={{ fontSize: 12, padding: '6px 14px' }}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ← Précédent
      </button>
      <span style={{ fontSize: 13, color: 'var(--abed-muted)', minWidth: 60, textAlign: 'center' }}>
        {page} / {pages}
      </span>
      <button
        className="btn secondary"
        style={{ fontSize: 12, padding: '6px 14px' }}
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
      >
        Suivant →
      </button>
    </div>
  )
}
