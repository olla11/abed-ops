'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { PresenceQuestion } from '@/lib/presence'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 15,
  border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

export default function PresenceForm({ slug, motifs, questions }: { slug: string; motifs: string[]; questions: PresenceQuestion[] }) {
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [motif, setMotif] = useState('')
  const [reponses, setReponses] = useState<Record<string, string>>({})
  // Piège à robots — un champ invisible pour les humains ; s'il est rempli à
  // la soumission, c'est un bot qui a rempli tous les champs du formulaire.
  const [piege, setPiege] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const dateStr = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !prenom.trim() || !telephone.trim()) { setErr('Nom, prénom et téléphone sont obligatoires.'); return }
    for (const q of questions) {
      if (q.requis && !(reponses[q.id] ?? '').trim()) { setErr(`« ${q.label} » est obligatoire.`); return }
    }
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/presence/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, prenom, telephone, email, motif, reponses, site: piege }),
      })
      if (res.ok) setDone(true)
      else { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Erreur lors de l'enregistrement.") }
    } catch {
      setErr('Erreur réseau — veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: 'system-ui, sans-serif', padding: '48px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 20px', background: 'white', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
          <Image src="/logoabed2.png" alt="ABED" width={56} height={56} style={{ objectFit: 'contain' }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>Enregistrement de présence</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 28px' }}>{dateStr}</p>

        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '28px 24px', textAlign: 'left' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#166534', margin: '0 0 8px' }}>Enregistrement confirmé</h2>
              <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>Merci {prenom} — votre présence a bien été enregistrée.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <Field label="Nom" required>
                <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} required />
              </Field>
              <Field label="Prénom" required>
                <input style={inputStyle} value={prenom} onChange={e => setPrenom(e.target.value)} required />
              </Field>
              <Field label="Téléphone" required>
                <input style={inputStyle} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} required />
              </Field>
              <Field label="Email (optionnel)">
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>

              {motifs.length > 0 && (
                <Field label="Motif de votre visite">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {motifs.map(m => (
                      <button key={m} type="button" onClick={() => setMotif(m)} style={{
                        padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${motif === m ? 'var(--abed-green, #16a34a)' : '#e5e7eb'}`,
                        background: motif === m ? '#f0fdf4' : 'white',
                        color: motif === m ? 'var(--abed-green, #16a34a)' : '#374151',
                      }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {questions.map(q => (
                <Field key={q.id} label={q.label} required={q.requis}>
                  {q.type === 'choix' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {(q.options ?? []).map(opt => (
                        <button key={opt} type="button" onClick={() => setReponses(r => ({ ...r, [q.id]: opt }))} style={{
                          padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          border: `1.5px solid ${reponses[q.id] === opt ? 'var(--abed-green, #16a34a)' : '#e5e7eb'}`,
                          background: reponses[q.id] === opt ? '#f0fdf4' : 'white',
                          color: reponses[q.id] === opt ? 'var(--abed-green, #16a34a)' : '#374151',
                        }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      style={inputStyle}
                      type={q.type === 'email' ? 'email' : q.type === 'telephone' ? 'tel' : 'text'}
                      value={reponses[q.id] ?? ''}
                      onChange={e => setReponses(r => ({ ...r, [q.id]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}

              {/* Piège à robots — masqué visuellement mais présent dans le DOM, un lecteur d'écran l'ignore via aria-hidden/tabIndex. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <input tabIndex={-1} autoComplete="off" value={piege} onChange={e => setPiege(e.target.value)} />
              </div>

              {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 14px' }}>{err}</p>}

              <button type="submit" disabled={saving} style={{
                width: '100%', padding: '14px 0', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: 'var(--abed-green, #16a34a)', color: 'white', border: 'none', cursor: 'pointer',
                opacity: saving ? .7 : 1,
              }}>
                {saving ? 'Enregistrement...' : 'Valider mon enregistrement'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
