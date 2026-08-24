'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, CalendarDays } from 'lucide-react'
import { TYPE_OPPORTUNITE_LABELS, type TypeOpportunite } from '@/lib/bd'
import { ResponsableSelect, AssociesMultiSelect, type Personne } from '../../PersonPickers'
import { Field, FieldGrid, FormSection, inputStyle, textareaStyle } from '../FormUI'

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

  // La bulle AGA (fixe, en bas à droite) chevauche le bouton "Créer
  // l'opportunité" du formulaire — masquée le temps de la page.
  useEffect(() => {
    document.body.classList.add('panel-open')
    return () => document.body.classList.remove('panel-open')
  }, [])

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
      <Link href="/bd/opportunites" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#6b7280', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> Retour aux opportunités
      </Link>
      <h2 style={{ color: '#111827', margin: '0 0 4px', fontSize: 21, fontWeight: 800 }}>Nouvelle opportunité</h2>
      <p style={{ fontSize: 13.5, color: '#6b7280', margin: '0 0 24px' }}>Renseignez un appel à projets ou un AMI identifié.</p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        <FormSection icon={FileText} color="#1e40af" title="Informations générales" description="Nature et description de l'appel">
          <FieldGrid columns={2}>
            <Field label="Type d'opportunité">
              <select value={typeOpportunite} onChange={e => setTypeOpportunite(e.target.value as TypeOpportunite)} style={inputStyle}>
                {(Object.keys(TYPE_OPPORTUNITE_LABELS) as TypeOpportunite[]).map(t => (
                  <option key={t} value={t}>{TYPE_OPPORTUNITE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Bailleur">
              <input value={bailleur} onChange={e => setBailleur(e.target.value)} placeholder="Ex. Union Européenne" style={inputStyle} />
            </Field>
          </FieldGrid>
          <Field label="Intitulé de l'appel *">
            <input value={titre} onChange={e => setTitre(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Description de l'appel" hint="Résumé en ~100 mots">
            <textarea value={descriptionAppel} onChange={e => setDescriptionAppel(e.target.value)} rows={4} style={textareaStyle} />
          </Field>
        </FormSection>

        <FormSection icon={Users} color="#6d28d9" title="Équipe assignée" description="Qui pilote et suit ce dossier">
          <Field label="Responsable de la soumission" hint="Reçoit une notification (in-app + email) et les rappels d'échéance.">
            <ResponsableSelect personnes={personnes} value={responsableId} onChange={setResponsableId} />
          </Field>
          <Field label="Personnes à associer" hint="Chacune reçoit aussi la notification et les rappels d'échéance.">
            <AssociesMultiSelect personnes={personnes} value={associesIds} onChange={setAssociesIds} />
          </Field>
        </FormSection>

        <FormSection icon={CalendarDays} color="#b45309" title="Calendrier" description="Dates clés de l'appel">
          <FieldGrid columns={2}>
            <Field label="Date de publication">
              <input type="date" value={datePublication} onChange={e => setDatePublication(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Date limite">
              <input type="date" value={dateLimite} onChange={e => setDateLimite(e.target.value)} style={inputStyle} />
            </Field>
          </FieldGrid>
        </FormSection>

        {err && <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href="/bd/opportunites" className="btn secondary">Annuler</Link>
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Création...' : "Créer l'opportunité"}</button>
        </div>
      </form>
    </div>
  )
}
