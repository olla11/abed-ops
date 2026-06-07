'use client'

type Tab = { key: string; label: string; count?: number }

export default function TabBar({
  tabs, active, onChange,
}: { tabs: Tab[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 0, borderBottom: '2px solid var(--abed-border)',
      marginBottom: 24,
    }}>
      {tabs.map(t => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '10px 22px', fontSize: 14, fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--abed-green)' : 'var(--abed-muted)',
              background: 'none', border: 'none', borderBottom: isActive ? '3px solid var(--abed-green)' : '3px solid transparent',
              marginBottom: -2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'color .15s',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                background: isActive ? 'var(--abed-green)' : '#e5e7eb',
                color: isActive ? 'white' : '#374151',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                padding: '1px 7px', minWidth: 20, textAlign: 'center',
              }}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
