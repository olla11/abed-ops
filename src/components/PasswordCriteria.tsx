'use client'

export const PASSWORD_RULES = [
  { id: 'len',     label: 'Au moins 8 caractères',              test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'Au moins 1 lettre majuscule (A-Z)',  test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Au moins 1 lettre minuscule (a-z)',  test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'Au moins 1 chiffre (0-9)',           test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Au moins 1 caractère spécial (!@#$%^&*…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export function isPasswordStrong(password: string) {
  return PASSWORD_RULES.every(r => r.test(password))
}

export default function PasswordCriteria({ password }: { password: string }) {
  if (!password) return null
  return (
    <div style={{
      marginTop: 8, padding: '10px 14px', background: '#f9fafb',
      border: '1px solid var(--abed-border)', borderRadius: 8, fontSize: 12,
    }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#374151', fontSize: 12 }}>
        Critères du mot de passe :
      </p>
      <div style={{ display: 'grid', gap: 4 }}>
        {PASSWORD_RULES.map(r => {
          const ok = r.test(password)
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: ok ? '#dcfce7' : '#fee2e2',
                color: ok ? '#166534' : '#991b1b',
                fontSize: 10, fontWeight: 700,
              }}>
                {ok ? '✓' : '✕'}
              </span>
              <span style={{ color: ok ? '#166534' : '#6b7280' }}>{r.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
