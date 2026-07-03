'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 4,
}

export default function InscriptionPage() {
  const [form, setForm] = useState({
    civilite: 'M.', nom: '', prenoms: '', email: '', password: '',
    telephone: '', fonction: '', adresse: '',
    date_naissance: '', lieu_naissance: '', nationalite: 'Béninoise',
    ifu: '', grade_indice: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) { setDone(true) }
    else { setErr(data.error ?? 'Erreur inconnue') }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--abed-bg, #f4f6f9)' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '48px 36px', width: 420, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
        <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Vérifiez votre email !</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
          Un email de confirmation a été envoyé à <strong>{form.email}</strong>.
        </p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
          Cliquez sur le bouton <strong>«&nbsp;Valider mon email&nbsp;»</strong> dans cet email pour activer votre compte.
        </p>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px 16px', background: 'var(--abed-bg, #f4f6f9)' }}>
      <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '36px 32px', width: 560, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>Créer votre compte</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Rejoignez la plateforme My ABED</p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Civilité + Nom + Prénoms */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Civilité <span style={{ color: '#ef4444' }}>*</span></label>
              <select style={inp} value={form.civilite} onChange={e => set('civilite', e.target.value)} required>
                <option value="M.">Monsieur</option><option value="Mme">Madame</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Nom <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.nom} onChange={e => set('nom', e.target.value)} required placeholder="TCHICHE" />
            </div>
            <div>
              <label style={lbl}>Prénom(s) <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.prenoms} onChange={e => set('prenoms', e.target.value)} required placeholder="Aurès" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={lbl}>Email <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="vous@exemple.com" />
          </div>

          {/* Password */}
          <div>
            <label style={lbl}>Mot de passe <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 42 }}
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required minLength={8}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Minimum 8 caractères</p>
          </div>

          {/* Téléphone + Fonction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Téléphone <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.telephone} onChange={e => set('telephone', e.target.value)} required placeholder="+229 01 97 00 00 00" />
            </div>
            <div>
              <label style={lbl}>Fonction <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.fonction} onChange={e => set('fonction', e.target.value)} required placeholder="Chargé de projet" />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label style={lbl}>Adresse <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inp} value={form.adresse} onChange={e => set('adresse', e.target.value)} required placeholder="Cotonou, Bénin" />
          </div>

          {/* Date & lieu naissance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Date de naissance <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} type="date" value={form.date_naissance} onChange={e => set('date_naissance', e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Lieu de naissance <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.lieu_naissance} onChange={e => set('lieu_naissance', e.target.value)} required placeholder="Cotonou" />
            </div>
          </div>

          {/* Nationalité */}
          <div>
            <label style={lbl}>Nationalité <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inp} value={form.nationalite} onChange={e => set('nationalite', e.target.value)} required />
          </div>

          {/* IFU + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Numéro IFU <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.ifu} onChange={e => set('ifu', e.target.value)} required placeholder="Ex: 1234567890123" />
            </div>
            <div>
              <label style={lbl}>Grade / Indice</label>
              <input style={inp} value={form.grade_indice} onChange={e => set('grade_indice', e.target.value)} placeholder="Facultatif" />
            </div>
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--abed-green)', color: 'white', border: 'none',
              borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Création en cours…' : 'Créer mon compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20, marginBottom: 0 }}>
          Déjà un compte ?{' '}
          <Link href="/login" style={{ color: 'var(--abed-green)', fontWeight: 700, textDecoration: 'none' }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
