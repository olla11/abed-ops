'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

// Départ minimum : aujourd'hui (mais un avertissement s'affiche si c'est aujourd'hui)
function minDepart() {
  return new Date().toISOString().split('T')[0]
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

// Retour maximum : départ + 1 an
function maxRetour(depart: string) {
  if (!depart) return ''
  const d = new Date(depart)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

export default function NouvelleMission() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    objet: '',
    lieu: '',
    moyen_transport: '',
    conducteur_a_bord: '',
    date_depart: '',
    date_arrivee_destination: '',
    date_depart_destination: '',
    date_retour: '',
    imputation: '',
    a_charge_partenaire: false,
  })

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function validate(): string | null {
    const today = minDepart()
    if (form.date_depart && form.date_depart < today) {
      return `La date de départ ne peut pas être dans le passé.`
    }
    if (form.date_retour && form.date_depart && form.date_retour <= form.date_depart) {
      return 'La date de retour doit être après la date de départ.'
    }
    if (form.date_retour && form.date_depart) {
      const max = maxRetour(form.date_depart)
      if (form.date_retour > max) return 'La durée de la mission ne peut pas dépasser 1 an.'
    }
    return null
  }

  async function submit(e: React.FormEvent, statut: 'brouillon' | 'soumis') {
    e.preventDefault()
    if (statut === 'soumis') {
      const validErr = validate()
      if (validErr) { setErr(validErr); return }
    }
    setSaving(true); setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('missions').insert({
      ...form,
      missionnaire_id: user.id,
      status: statut,
    })
    setSaving(false)
    if (error) setErr(error.message)
    else router.push('/dashboard')
  }

  const today = minDepart()
  const sameDayWarning = form.date_depart && isToday(form.date_depart)

  return (
    <div className="page-container">
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
      <h2 style={{ color: 'var(--abed-green)', margin: '12px 0 24px' }}>Demander un Ordre de Mission</h2>
      <div className="card">
        <form>

          <div className="field">
            <label className="label">Objet de la mission *</label>
            <input className="input" value={form.objet} onChange={e => set('objet', e.target.value)} required />
          </div>

          <div className="field">
            <label className="label">Lieu de la mission *</label>
            <input className="input" value={form.lieu} onChange={e => set('lieu', e.target.value)} required />
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="label">Moyen de transport</label>
              <select className="input" value={form.moyen_transport} onChange={e => set('moyen_transport', e.target.value)}>
                <option value="">— Choisir —</option>
                <option>Véhicule de service</option>
                <option>Moto</option>
                <option>Bus / transport commun</option>
                <option>Avion</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Conducteur à bord</label>
              <input className="input" placeholder="Nom du conducteur (si véhicule de service)"
                value={form.conducteur_a_bord} onChange={e => set('conducteur_a_bord', e.target.value)} />
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 12px' }}>
            Dates du voyage — le départ peut être aujourd&apos;hui ou plus tard.
          </p>
          {sameDayWarning && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                <strong>Attention :</strong> Vous effectuez une demande d&apos;ordre de mission le jour même de la mission. Cela n&apos;est pas conforme aux procédures internes qui exigent que la demande soit soumise à l&apos;avance. Votre demande sera traitée, mais veuillez respecter les délais à l&apos;avenir.
              </p>
            </div>
          )}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="label">Départ de l'origine *</label>
              <input className="input" type="date" value={form.date_depart}
                min={today}
                onChange={e => set('date_depart', e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Arrivée à destination</label>
              <input className="input" type="date" value={form.date_arrivee_destination}
                min={form.date_depart || today}
                onChange={e => set('date_arrivee_destination', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Départ de la destination</label>
              <input className="input" type="date" value={form.date_depart_destination}
                min={form.date_arrivee_destination || form.date_depart || today}
                onChange={e => set('date_depart_destination', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Retour à l'origine *</label>
              <input className="input" type="date" value={form.date_retour}
                min={form.date_depart_destination || form.date_depart || today}
                max={maxRetour(form.date_depart)}
                onChange={e => set('date_retour', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label className="label">Imputation budgétaire</label>
            <input className="input" placeholder="ex : IYBA-SEED, FEDSAEI…"
              value={form.imputation} onChange={e => set('imputation', e.target.value)} />
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.a_charge_partenaire}
                onChange={e => set('a_charge_partenaire', e.target.checked)} />
              <span>Mission à charge d'un partenaire (prélèvement 20 % applicable)</span>
            </label>
          </div>

          {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn secondary" disabled={saving}
              onClick={e => submit(e, 'brouillon')}>
              {saving ? '…' : 'Enregistrer brouillon'}
            </button>
            <button type="button" className="btn"
              disabled={saving || !form.objet || !form.lieu || !form.date_depart || !form.date_retour}
              onClick={e => submit(e, 'soumis')}>
              {saving ? 'Envoi…' : 'Soumettre pour signature'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
