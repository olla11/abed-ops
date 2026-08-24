'use client'

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, color: '#111827',
  border: '1px solid #e5e7eb', boxSizing: 'border-box', background: 'white',
}
export const textareaStyle: React.CSSProperties = { ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }

export function Field({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 6, color: '#374151' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 0 0' }}>{hint}</p>}
    </div>
  )
}

export function FieldGrid({ columns = 2, children }: { columns?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(560 / columns)}px, 1fr))`, gap: 16 }}>
      {children}
    </div>
  )
}

export function FormSection({
  icon: Icon, color = '#1e40af', title, description, children,
}: { icon: any; color?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, border: '1px solid #eef0f2',
      boxShadow: '0 1px 2px rgba(16,24,40,.04)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color + '15', color, flexShrink: 0,
        }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#111827' }}>{title}</h3>
          {description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{description}</p>}
        </div>
      </div>
      <div style={{ padding: 22, display: 'grid', gap: 16 }}>{children}</div>
    </div>
  )
}
