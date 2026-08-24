'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PiecesJointesList from '@/components/PiecesJointesList'
import { STATUT_LABELS, OPPORTUNITE_STATUTS, type OpportuniteStatut } from '@/lib/bd'

type Piece = { path: string; nom: string }

type Opportunite = {
  id: string
  titre: string
  bailleur: string | null
  description_appel: string | null
  personnes_associees: string | null
  date_identification: string
  date_publication: string | null
  date_limite: string | null
  date_soumission: string | null
  description_proposition: string | null
  commentaires: string | null
  observations: string | null
  statut: OpportuniteStatut
  montant_demande: number | null
  montant_obtenu: number | null
  pieces_jointes: Piece[] | null
  identifie_par: { nom: string; prenoms: string } | null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#6b7280' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box' }
const textareaStyle: React.CSSProperties = { ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }

export default function OpportuniteDetailClient({ opportunite, peutGerer }: { opportunite: Opportunite; peutGerer: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({
    titre: opportunite.titre,
    bailleur: opportunite.bailleur ?? '',
    description_appel: opportunite.description_appel ?? '',
    personnes_associees: opportunite.personnes_associees ?? '',
    date_publication: opportunite.date_publication ?? '',
    date_limite: opportunite.date_limite ?? '',
    date_soumission: opportunite.date_soumission ?? '',
    description_proposition: opportunite.description_proposition ?? '',
    commentaires: opportunite.commentaires ?? '',
    observations: opportunite.observations ?? '',
    statut: opportunite.statut,
    montant_demande: opportunite.montant_demande?.toString() ?? '',
    montant_obtenu: opportunite.montant_obtenu?.toString() ?? '',
  })
  const [pieces, setPieces] = useState<Piece[]>(Array.isArray(opportunite.pieces_jointes) ? opportunite.pieces_jointes : [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleUpload(file: File | null) {
    if (!file) return
    setUploading(true); setErr(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/bd/opportunites/${opportunite.id}/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setErr(data.error ?? 'Erreur d\'upload'); return }
    setPieces(prev => [...prev, { path: data.path, nom: data.nom }])
  }

  async function save() {
    setSaving(true); setMsg(null); setErr(null)
    const res = await fetch(`/api/bd/opportunites/${opportunite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        montant_demande: form.montant_demande ? Number(form.montant_demande) : null,
        montant_obtenu: form.montant_obtenu ? Number(form.montant_obtenu) : null,
        date_publication: form.date_publication || null,
        date_limite: form.date_limite || null,
        date_soumission: form.date_soumission || null,
        pieces_jointes: pieces,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error ?? 'Erreur'); return }
    setMsg('Enregistré.')
    router.refresh()
  }

  async function supprimer() {
    if (!confirm('Supprimer définitivement cette opportunité ?')) return
    setDeleting(true)
    const res = await fetch(`/api/bd/opportunites/${opportunite.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/bd/opportunites')
    else { setDeleting(false); const d = await res.json(); setErr(d.error ?? 'Erreur') }
  }

  if (!peutGerer) {
    return (
      <div>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 4px' }}>{opportunite.titre}</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>{opportunite.bailleur ?? 'Bailleur non précisé'}</p>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <Row label="Statut" value={STATUT_LABELS[opportunite.statut]} />
          <Row label="Identifiée par" value={opportunite.identifie_par ? `${opportunite.identifie_par.prenoms} ${opportunite.identifie_par.nom}` : '—'} />
          <Row label="Date d'identification" value={fmtDate(opportunite.date_identification)} />
          <Row label="Date de publication" value={fmtDate(opportunite.date_publication)} />
          <Row label="Date limite" value={fmtDate(opportunite.date_limite)} />
          <Row label="Date de soumission" value={fmtDate(opportunite.date_soumission)} />
          <Row label="Montant demandé" value={opportunite.montant_demande ? `${opportunite.montant_demande.toLocaleString('fr-FR')} FCFA` : '—'} />
          <Row label="Montant obtenu" value={opportunite.montant_obtenu ? `${opportunite.montant_obtenu.toLocaleString('fr-FR')} FCFA` : '—'} />
          <Row label="Description de l'appel" value={opportunite.description_appel} />
          <Row label="Description de la proposition" value={opportunite.description_proposition} />
          <Row label="Commentaires" value={opportunite.commentaires} />
          <Row label="Observations" value={opportunite.observations} />
          <PiecesJointesList pieces={pieces} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 20px' }}>{opportunite.titre}</h2>
      <div className="card" style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <Field label="Intitulé de l'appel">
          <input value={form.titre} onChange={e => set('titre', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Bailleur">
          <input value={form.bailleur} onChange={e => set('bailleur', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Statut">
          <select value={form.statut} onChange={e => set('statut', e.target.value as OpportuniteStatut)} style={inputStyle}>
            {OPPORTUNITE_STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="Description de l'appel (~100 mots)">
          <textarea value={form.description_appel} onChange={e => set('description_appel', e.target.value)} rows={4} style={textareaStyle} />
        </Field>
        <Field label="Personnes à associer">
          <input value={form.personnes_associees} onChange={e => set('personnes_associees', e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Field label="Date de publication">
            <input type="date" value={form.date_publication} onChange={e => set('date_publication', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Date limite">
            <input type="date" value={form.date_limite} onChange={e => set('date_limite', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Date de soumission">
            <input type="date" value={form.date_soumission} onChange={e => set('date_soumission', e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Montant demandé (FCFA)">
            <input type="number" value={form.montant_demande} onChange={e => set('montant_demande', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Montant obtenu (FCFA)">
            <input type="number" value={form.montant_obtenu} onChange={e => set('montant_obtenu', e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="Description de la proposition faite">
          <textarea value={form.description_proposition} onChange={e => set('description_proposition', e.target.value)} rows={4} style={textareaStyle} />
        </Field>
        <Field label="Commentaires">
          <textarea value={form.commentaires} onChange={e => set('commentaires', e.target.value)} rows={2} style={textareaStyle} />
        </Field>
        <Field label="Observations">
          <textarea value={form.observations} onChange={e => set('observations', e.target.value)} rows={2} style={textareaStyle} />
        </Field>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: '#6b7280' }}>Pièces jointes</label>
          <PiecesJointesList pieces={pieces} />
          <input type="file" onChange={e => handleUpload(e.target.files?.[0] ?? null)} disabled={uploading} style={{ marginTop: 10, fontSize: 12.5 }} />
          {uploading && <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '6px 0 0' }}>Envoi en cours...</p>}
        </div>

        {err && <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>{err}</p>}
        {msg && <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>{msg}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={save} className="btn" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button onClick={supprimer} disabled={deleting} style={{ background: 'none', border: 'none', color: '#991b1b', fontSize: 13, cursor: 'pointer' }}>
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#374151', marginTop: 2, whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )
}
