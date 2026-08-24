'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NouvelleOpportunitePage() {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [bailleur, setBailleur] = useState('')
  const [descriptionAppel, setDescriptionAppel] = useState('')
  const [personnesAssociees, setPersonnesAssociees] = useState('')
  const [datePublication, setDatePublication] = useState('')
  const [dateLimite, setDateLimite] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setErr("L'intitulé de l'appel est requis."); return }
    setLoading(true); setErr(null)
    const res = await fetch('/api/bd/opportunites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre, bailleur, description_appel: descriptionAppel, personnes_associees: personnesAssociees,
        date_publication: datePublication || null, date_limite: dateLimite || null,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? 'Erreur'); return }
    router.push(`/bd/opportunites/${data.id}`)
  }

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 20px' }}>Nouvelle opportunité</h2>
      <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Intitulé de l&apos;appel *</label>
          <input value={titre} onChange={e => setTitre(e.target.value)} required
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Bailleur</label>
          <input value={bailleur} onChange={e => setBailleur(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Description de l&apos;appel (~100 mots)</label>
          <textarea value={descriptionAppel} onChange={e => setDescriptionAppel(e.target.value)} rows={4}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Personnes à associer</label>
          <input value={personnesAssociees} onChange={e => setPersonnesAssociees(e.target.value)} placeholder="Noms séparés par une virgule"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date de publication</label>
            <input type="date" value={datePublication} onChange={e => setDatePublication(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date limite</label>
            <input type="date" value={dateLimite} onChange={e => setDateLimite(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
          </div>
        </div>
        {err && <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Création...' : 'Créer'}</button>
        </div>
      </form>
    </div>
  )
}
