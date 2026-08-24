'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TYPE_OPPORTUNITE_LABELS, type TypeOpportunite } from '@/lib/bd'
import { ResponsableSelect, AssociesMultiSelect, type Personne } from '../../PersonPickers'

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }
const textareaStyle: React.CSSProperties = { ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }

export default function NouvelleOpportuniteForm({ personnes }: { personnes: Personne[] }) {
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [typeOpportunite, setTypeOpportunite] = useState<TypeOpportunite>('appel_a_projets')
  const [bailleur, setBailleur] = useState('')
  const [descriptionAppel, setDescriptionAppel] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [associesIds, setAssociesIds] = useState<string[]>([])
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
        titre, type_opportunite: typeOpportunite, bailleur, description_appel: descriptionAppel,
        responsable_id: responsableId || null, associes_ids: associesIds,
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
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Type d&apos;opportunité</label>
          <select value={typeOpportunite} onChange={e => setTypeOpportunite(e.target.value as TypeOpportunite)} style={inputStyle}>
            {(Object.keys(TYPE_OPPORTUNITE_LABELS) as TypeOpportunite[]).map(t => (
              <option key={t} value={t}>{TYPE_OPPORTUNITE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Intitulé de l&apos;appel *</label>
          <input value={titre} onChange={e => setTitre(e.target.value)} required style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Bailleur</label>
          <input value={bailleur} onChange={e => setBailleur(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Description de l&apos;appel (~100 mots)</label>
          <textarea value={descriptionAppel} onChange={e => setDescriptionAppel(e.target.value)} rows={4} style={textareaStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Responsable de la soumission</label>
          <ResponsableSelect personnes={personnes} value={responsableId} onChange={setResponsableId} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Reçoit une notification (in-app + email) et les rappels d&apos;échéance.</p>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Personnes à associer</label>
          <AssociesMultiSelect personnes={personnes} value={associesIds} onChange={setAssociesIds} />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Chacune reçoit aussi la notification et les rappels d&apos;échéance.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date de publication</label>
            <input type="date" value={datePublication} onChange={e => setDatePublication(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>Date limite</label>
            <input type="date" value={dateLimite} onChange={e => setDateLimite(e.target.value)} style={inputStyle} />
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
