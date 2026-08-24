'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, CalendarDays, Wallet, StickyNote, Paperclip, Trash2 } from 'lucide-react'
import PiecesJointesList from '@/components/PiecesJointesList'
import { STATUT_LABELS, STATUT_COLORS, OPPORTUNITE_STATUTS, TYPE_OPPORTUNITE_LABELS, type OpportuniteStatut, type TypeOpportunite } from '@/lib/bd'
import { ResponsableSelect, AssociesMultiSelect, type Personne } from '../../PersonPickers'
import { Field, FieldGrid, FormSection, inputStyle, textareaStyle } from '../FormUI'

type Piece = { path: string; nom: string }

type Opportunite = {
  id: string
  titre: string
  bailleur: string | null
  description_appel: string | null
  type_opportunite: TypeOpportunite
  responsable_id: string | null
  associes_ids: string[]
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
  responsable: { nom: string; prenoms: string } | null
}

function StatutBadge({ statut }: { statut: OpportuniteStatut }) {
  const color = STATUT_COLORS[statut]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color,
      background: color + '15', border: `1px solid ${color}40`, borderRadius: 20, padding: '4px 12px',
    }}>
      {STATUT_LABELS[statut]}
    </span>
  )
}

export default function OpportuniteDetailClient({ opportunite, peutGerer, personnes }: { opportunite: Opportunite; peutGerer: boolean; personnes: Personne[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    titre: opportunite.titre,
    bailleur: opportunite.bailleur ?? '',
    description_appel: opportunite.description_appel ?? '',
    type_opportunite: opportunite.type_opportunite,
    responsable_id: opportunite.responsable_id ?? '',
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
  const [associesIds, setAssociesIds] = useState<string[]>(opportunite.associes_ids ?? [])
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
    setUploading(true); setErr(null); setMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/bd/opportunites/${opportunite.id}/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setUploading(false); setErr(data.error ?? 'Erreur d\'upload'); return }

    const nouvellesPieces = [...pieces, { path: data.path, nom: data.nom }]
    const patch = await fetch(`/api/bd/opportunites/${opportunite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pieces_jointes: nouvellesPieces }),
    })
    setUploading(false)
    if (!patch.ok) { const d = await patch.json(); setErr(d.error ?? 'Erreur d\'enregistrement de la pièce jointe'); return }
    setPieces(nouvellesPieces)
    setMsg('Pièce jointe enregistrée.')
  }

  async function save() {
    setSaving(true); setMsg(null); setErr(null)
    const res = await fetch(`/api/bd/opportunites/${opportunite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        responsable_id: form.responsable_id || null,
        associes_ids: associesIds,
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

  const header = (
    <div style={{ marginBottom: 24 }}>
      <Link href="/bd/opportunites" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#6b7280', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> Retour aux opportunités
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ color: '#111827', margin: 0, fontSize: 21, fontWeight: 800 }}>{opportunite.titre}</h2>
        <StatutBadge statut={opportunite.statut} />
      </div>
      <p style={{ fontSize: 13.5, color: '#6b7280', margin: '4px 0 0' }}>
        {TYPE_OPPORTUNITE_LABELS[opportunite.type_opportunite]} — {opportunite.bailleur ?? 'Bailleur non précisé'}
      </p>
    </div>
  )

  if (!peutGerer) {
    const associesNoms = (opportunite.associes_ids ?? [])
      .map(id => personnes.find(p => p.id === id))
      .filter(Boolean)
      .map(p => `${p!.prenoms} ${p!.nom}`)
      .join(', ')
    return (
      <div>
        {header}
        <div style={{ display: 'grid', gap: 18 }}>
          <FormSection icon={FileText} color="#1e40af" title="Informations générales">
            <FieldGrid columns={2}>
              <Row label="Date d'identification" value={fmtDate(opportunite.date_identification)} />
              <Row label="Identifiée par" value={opportunite.identifie_par ? `${opportunite.identifie_par.prenoms} ${opportunite.identifie_par.nom}` : '—'} />
            </FieldGrid>
            <Row label="Description de l'appel" value={opportunite.description_appel} />
          </FormSection>

          <FormSection icon={Users} color="#6d28d9" title="Équipe assignée">
            <FieldGrid columns={2}>
              <Row label="Responsable de la soumission" value={opportunite.responsable ? `${opportunite.responsable.prenoms} ${opportunite.responsable.nom}` : '—'} />
              <Row label="Personnes associées" value={associesNoms || null} />
            </FieldGrid>
          </FormSection>

          <FormSection icon={CalendarDays} color="#b45309" title="Calendrier">
            <FieldGrid columns={3}>
              <Row label="Date de publication" value={fmtDate(opportunite.date_publication)} />
              <Row label="Date limite" value={fmtDate(opportunite.date_limite)} />
              <Row label="Date de soumission" value={fmtDate(opportunite.date_soumission)} />
            </FieldGrid>
          </FormSection>

          <FormSection icon={Wallet} color="#0f766e" title="Finances">
            <FieldGrid columns={2}>
              <Row label="Montant demandé" value={opportunite.montant_demande ? `${opportunite.montant_demande.toLocaleString('fr-FR')} FCFA` : '—'} />
              <Row label="Montant obtenu" value={opportunite.montant_obtenu ? `${opportunite.montant_obtenu.toLocaleString('fr-FR')} FCFA` : '—'} />
            </FieldGrid>
          </FormSection>

          <FormSection icon={StickyNote} color="#92660b" title="Suivi & documentation">
            <Row label="Description de la proposition" value={opportunite.description_proposition} />
            <Row label="Commentaires" value={opportunite.commentaires} />
            <Row label="Observations" value={opportunite.observations} />
          </FormSection>

          <FormSection icon={Paperclip} color="#374151" title="Pièces jointes">
            <PiecesJointesList pieces={pieces} />
          </FormSection>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <div style={{ display: 'grid', gap: 18 }}>
        <FormSection icon={FileText} color="#1e40af" title="Informations générales">
          <FieldGrid columns={2}>
            <Field label="Type d'opportunité">
              <select value={form.type_opportunite} onChange={e => set('type_opportunite', e.target.value as TypeOpportunite)} style={inputStyle}>
                {(Object.keys(TYPE_OPPORTUNITE_LABELS) as TypeOpportunite[]).map(t => (
                  <option key={t} value={t}>{TYPE_OPPORTUNITE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select value={form.statut} onChange={e => set('statut', e.target.value as OpportuniteStatut)} style={inputStyle}>
                {OPPORTUNITE_STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
              </select>
            </Field>
          </FieldGrid>
          <Field label="Bailleur">
            <input value={form.bailleur} onChange={e => set('bailleur', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Intitulé de l'appel">
            <input value={form.titre} onChange={e => set('titre', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Description de l'appel" hint="Résumé en ~100 mots">
            <textarea value={form.description_appel} onChange={e => set('description_appel', e.target.value)} rows={4} style={textareaStyle} />
          </Field>
        </FormSection>

        <FormSection icon={Users} color="#6d28d9" title="Équipe assignée">
          <Field label="Responsable de la soumission">
            <ResponsableSelect personnes={personnes} value={form.responsable_id} onChange={v => set('responsable_id', v)} />
          </Field>
          <Field label="Personnes à associer">
            <AssociesMultiSelect personnes={personnes} value={associesIds} onChange={setAssociesIds} />
          </Field>
        </FormSection>

        <FormSection icon={CalendarDays} color="#b45309" title="Calendrier">
          <FieldGrid columns={3}>
            <Field label="Date de publication">
              <input type="date" value={form.date_publication} onChange={e => set('date_publication', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Date limite">
              <input type="date" value={form.date_limite} onChange={e => set('date_limite', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Date de soumission">
              <input type="date" value={form.date_soumission} onChange={e => set('date_soumission', e.target.value)} style={inputStyle} />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection icon={Wallet} color="#0f766e" title="Finances">
          <FieldGrid columns={2}>
            <Field label="Montant demandé (FCFA)">
              <input type="number" value={form.montant_demande} onChange={e => set('montant_demande', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Montant obtenu (FCFA)">
              <input type="number" value={form.montant_obtenu} onChange={e => set('montant_obtenu', e.target.value)} style={inputStyle} />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection icon={StickyNote} color="#92660b" title="Suivi & documentation">
          <Field label="Description de la proposition faite">
            <textarea value={form.description_proposition} onChange={e => set('description_proposition', e.target.value)} rows={4} style={textareaStyle} />
          </Field>
          <Field label="Commentaires">
            <textarea value={form.commentaires} onChange={e => set('commentaires', e.target.value)} rows={2} style={textareaStyle} />
          </Field>
          <Field label="Observations">
            <textarea value={form.observations} onChange={e => set('observations', e.target.value)} rows={2} style={textareaStyle} />
          </Field>
        </FormSection>

        <FormSection icon={Paperclip} color="#374151" title="Pièces jointes">
          <PiecesJointesList pieces={pieces} />
          <input type="file" onChange={e => handleUpload(e.target.files?.[0] ?? null)} disabled={uploading} style={{ fontSize: 12.5 }} />
          {uploading && <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Envoi en cours...</p>}
        </FormSection>

        {err && <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>{err}</p>}
        {msg && <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>{msg}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={supprimer} disabled={deleting} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            color: '#991b1b', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '10px 4px',
          }}>
            <Trash2 size={14} /> {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
          <button onClick={save} className="btn" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
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
      <div style={{ fontSize: 14, color: '#374151', marginTop: 3, whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )
}
