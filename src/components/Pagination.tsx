'use client'

type Props = {
  page: number
  total: number
  pageSize?: number
  onChange: (page: number) => void
}

export const PAGE_SIZE = 10

export default function Pagination({ page, total, pageSize = PAGE_SIZE, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    cursor: active ? 'pointer' : 'not-allowed',
    border: '1px solid var(--abed-border)',
    background: active ? 'white' : '#f3f4f6',
    color: active ? '#374151' : '#9ca3af',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, padding: '12px 4px' }}>
      <button style={btn(page > 1)} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Précédent
      </button>
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        Page <strong style={{ color: '#111827' }}>{page}</strong> / {totalPages}
        <span style={{ color: '#9ca3af', marginLeft: 8 }}>({total} élément{total > 1 ? 's' : ''})</span>
      </span>
      <button style={btn(page < totalPages)} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Suivant →
      </button>
    </div>
  )
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}
