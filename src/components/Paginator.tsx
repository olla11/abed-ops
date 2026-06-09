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

  // Génère les numéros à afficher (max 5, avec ellipsis si besoin)
  function getPageNumbers(): (number | '...')[] {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
    const nums: (number | '...')[] = []
    nums.push(1)
    if (page > 3) nums.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
      nums.push(i)
    }
    if (page < pages - 2) nums.push('...')
    nums.push(pages)
    return nums
  }

  const btnBase: React.CSSProperties = {
    border: '1px solid var(--abed-border)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    background: 'white',
    color: '#374151',
    minWidth: 36,
    textAlign: 'center',
  }

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--abed-green)',
    color: 'white',
    border: '1px solid var(--abed-green)',
  }

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    color: '#9ca3af',
    cursor: 'default',
    background: '#f9fafb',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 16, paddingTop: 14,
      borderTop: '1px solid var(--abed-border)',
      flexWrap: 'wrap',
    }}>
      <button
        style={page === 1 ? btnDisabled : btnBase}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        « Précédent
      </button>

      {getPageNumbers().map((n, i) =>
        n === '...' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '6px 4px', fontSize: 13, color: '#9ca3af' }}>…</span>
        ) : (
          <button
            key={n}
            style={n === page ? btnActive : btnBase}
            onClick={() => n !== page && onChange(n as number)}
          >
            {n}
          </button>
        )
      )}

      <button
        style={page === pages ? btnDisabled : btnBase}
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
      >
        Suivant »
      </button>
    </div>
  )
}
