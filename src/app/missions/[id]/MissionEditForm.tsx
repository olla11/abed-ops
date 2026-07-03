'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mission = {
  id: string
  objet: string
  lieu: string
  moyen_transport: string | null
  conducteur_a_bord: string | null
  date_depart: string
  date_arrivee_destination: string | null
  date_depart_destination: string | null
  date_retour: string
  imputation: string | null
  a_charge_partenaire: boolean
}

export default function MissionEditForm({ mission }: { mission: Mission }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    objet: mission.objet ?? '',
    lieu: mission.lieu ?? '',
    moyen_transport: mission.moyen_transport ?? '',
    conducteur_a_bord: mission.conducteur_a_bord ?? '',
    date_depart: mission.date_depart ?? '',
    date_arrivee_destination: mission.date_arrivee_destination ?? '',
    date_depart_destination: mission.date_depart_destination ?? '',
    date_retour: mission.date_retour ?? '',
    imputation: mission.imputation ?? '',
    a_charge_partenaire: mission.a_charge_partenaire ?? false,
  })

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    const res = await fetch(`/api/missions/${mission.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) { setOpen(false); router.refresh() }
    else setErr(data.error ?? 'Erreur inconnue')
  }

  if (!open) {
    return (
      <button className="btn secondary" onClick={() => setOpen(true)}>
        Modifier la mission
      </button>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--abed-amber)' }}>
      <h3 style={{ marginBottom: 16, fontSize: 15 }}>Modifier la mission</h3>
      <form onSubmit={save}>
        <div className="field">
          <label className="label">Objet *</label>
          <input className="input" value={form.objet} onChange={e => set('objet', e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Lieu *</label>
          <input className="input" value={form.lieu} onChange={e => set('lieu', e.target.value)} required />
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label className="label">Moyen de transport</label>
            <select className="input" value={form.moyen_transport} onChange={e => set('moyen_transport', e.target.value)}>
              <option value="">— Choisir —</option>
              <option>Vehicule de service</option>
              <option>Moto</option>
              <option>Bus / transport commun</option>
              <option>Avion</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Conducteur a bord</label>
            <input className="input" value={form.conducteur_a_bord} onChange={e => set('conducteur_a_bord', e.target.value)} />
          </div>
        </div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label className="label">Depart de l origine *</label>
            <input className="input" type="date" value={form.date_depart} onChange={e => set('date_depart', e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Arrivee a destination</label>
            <input className="input" type="date" value={form.date_arrivee_destination} onChange={e => set('date_arrivee_destination', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Depart de la destination</label>
            <input className="input" type="date" value={form.date_depart_destination} onChange={e => set('date_depart_destination', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Retour a l origine *</label>
            <input className="input" type="date" value={form.date_retour} onChange={e => set('date_retour', e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label className="label">Imputation budgetaire</label>
          <input className="input" value={form.imputation} onChange={e => set('imputation', e.target.value)} />
        </div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.a_charge_partenaire} onChange={e => set('a_charge_partenaire', e.target.checked)} />
            <span>Mission a charge d un partenaire (prelevement 20 %)</span>
          </label>
        </div>
        {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Annuler</button>
        </div>
      </form>
    </div>
  )
}