'use client'
import { useState } from 'react'
import type { PresenceQuestion } from '@/lib/presence'
import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 15px', borderRadius: 12, fontSize: 15,
  border: '1.5px solid #e5e7eb', outline: 'none', boxSizing: 'border-box',
  background: '#fafafa', transition: 'border-color .15s, background .15s',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 7 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function ChipGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{
          padding: '10px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          border: value === opt ? 'none' : '1.5px solid #e5e7eb',
          background: value === opt ? '#1f7a1f' : '#fafafa',
          color: value === opt ? 'white' : '#374151',
          boxShadow: value === opt ? '0 2px 8px rgba(31,122,31,.28)' : 'none',
          transition: 'all .12s',
        }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

// Vague verte/or ABED — identique à l'entête des PDF (contrats, OM...) pour
// une identité visuelle cohérente sur ce point de contact public, plutôt que
// la carte blanche générique reprise de la référence envoyée par l'admin.
function WaveBanner() {
  return (
    <div style={{ position: 'relative', height: 132, overflow: 'hidden' }}>
      <svg viewBox="0 0 1200 170" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
        <path d="M0,0 H1200 V70 C950,150 850,20 600,70 C350,120 250,10 0,90 Z" fill="#f4b93e" />
        <path d="M0,0 H1200 V55 C950,135 850,5 600,55 C350,105 250,-5 0,75 Z" fill="#1f7a1f" />
      </svg>
    </div>
  )
}

export default function PresenceForm({ slug, motifs, questions }: { slug: string; motifs: string[]; questions: PresenceQuestion[] }) {
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [motif, setMotif] = useState('')
  const [motifAutre, setMotifAutre] = useState('')
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
    if (motif === 'Autre' && !motifAutre.trim()) { setErr('Précisez le motif de votre visite.'); return }
    for (const q of questions) {
      if (q.requis && !(reponses[q.id] ?? '').trim()) { setErr(`« ${q.label} » est obligatoire.`); return }
    }
    setSaving(true); setErr(null)
    // Le motif "Autre" seul n'est pas exploitable dans le registre de
    // l'accueil — on enregistre directement la précision donnée.
    const motifFinal = motif === 'Autre' && motifAutre.trim() ? motifAutre.trim() : motif
    try {
      const res = await fetch(`/api/presence/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, prenom, telephone, email, motif: motifFinal, reponses, site: piege }),
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
    // marginTop négatif : globals.css réserve 60px en haut de <body> pour
    // l'AppHeader fixe des pages authentifiées — cette page publique n'a pas
    // d'AppHeader, donc sans ce correctif la bannière reste décalée du bord
    // supérieur au lieu d'être pleine hauteur/pleine largeur.
    <div style={{ minHeight: '100vh', marginTop: -60, background: '#f4f6f4', fontFamily: 'system-ui, sans-serif' }}>
      <WaveBanner />

      <div style={{ maxWidth: 480, margin: '-58px auto 0', padding: '0 16px 48px', textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, margin: '0 auto 16px', background: 'white', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          boxShadow: '0 6px 20px rgba(0,0,0,.14)', border: '4px solid white',
        }}>
          {/* Logo encodé en base64 (déjà utilisé pour l'entête des PDF) plutôt
              qu'un fichier chargé depuis /public : rendu garanti quel que soit
              l'appareil/réseau, sans dépendre d'une requête réseau séparée qui
              échouait de façon intermittente sur mobile. */}
          <img src={`data:image/png;base64,${LOGO_COLOR_PNG_B64}`} alt="ABED" width={80} height={80} style={{ objectFit: 'contain' }} />
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#111827', margin: '0 0 4px', letterSpacing: '-.2px' }}>
          Bienvenue à ABED-ONG
        </h1>
        <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 26px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          Enregistrement de présence · {dateStr}
        </p>

        <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 10px 32px rgba(0,0,0,.08)', padding: '30px 24px', textAlign: 'left' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1f7a1f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#166534', margin: '0 0 8px' }}>Enregistrement confirmé</h2>
              <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>Merci {prenom} — votre présence a bien été enregistrée. Bonne visite !</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nom" required>
                  <input style={inputStyle} value={nom} onChange={e => setNom(e.target.value)} required />
                </Field>
                <Field label="Prénom" required>
                  <input style={inputStyle} value={prenom} onChange={e => setPrenom(e.target.value)} required />
                </Field>
              </div>
              <Field label="Téléphone" required>
                <input style={inputStyle} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} required />
              </Field>
              <Field label="Email (optionnel)">
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>

              {motifs.length > 0 && (
                <Field label="Motif de votre visite">
                  <ChipGrid options={motifs} value={motif} onChange={v => { setMotif(v); if (v !== 'Autre') setMotifAutre('') }} />
                  {motif === 'Autre' && (
                    <input
                      style={{ ...inputStyle, marginTop: 10 }}
                      placeholder="Précisez le motif de votre visite"
                      value={motifAutre}
                      onChange={e => setMotifAutre(e.target.value)}
                      autoFocus
                    />
                  )}
                </Field>
              )}

              {questions.map(q => (
                <Field key={q.id} label={q.label} required={q.requis}>
                  {q.type === 'choix' ? (
                    <ChipGrid options={q.options ?? []} value={reponses[q.id] ?? ''} onChange={v => setReponses(r => ({ ...r, [q.id]: v }))} />
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
                width: '100%', padding: '15px 0', borderRadius: 999, fontSize: 15, fontWeight: 800,
                background: 'linear-gradient(135deg, #1f7a1f, #16a34a)', color: 'white', border: 'none', cursor: 'pointer',
                opacity: saving ? .7 : 1, marginTop: 6, boxShadow: '0 4px 14px rgba(31,122,31,.3)',
              }}>
                {saving ? 'Enregistrement...' : 'Valider mon enregistrement'}
              </button>
            </form>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 22 }}>ABED-ONG · Parakou, Quartier Zongo, Bénin</p>
      </div>
    </div>
  )
}
