'use client'
import { useState, useEffect } from 'react'

type Item = { id: string; nom?: string; code?: string; libelle?: string; ordre?: number }

const LISTES = [
  { key: 'departements',     label: 'Départements / Équipes',   fields: ['nom'] },
  { key: 'codes_budgetaires',label: 'Codes budgétaires',         fields: ['code', 'libelle'] },
  { key: 'projets',          label: 'Projets / Programmes',      fields: ['nom'] },
  { key: 'natures',          label: 'Natures de dépense',        fields: ['nom'] },
]

function itemLabel(item: Item) {
  if (item.code) return `${item.code} — ${item.libelle}`
  return item.nom ?? '—'
}

function ListeSection({ listKey, label, fields }: { listKey: string; label: string; fields: string[] }) {
  const [items, setItems] = useState<Item[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const r = await fetch(`/api/config/listes?type=${listKey}`)
    const j = await r.json()
    setItems(j.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function add() {
    for (const f of fields) {
      if (!form[f]?.trim()) { setMsg(`Champ requis : ${f}`); return }
    }
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/listes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: listKey, ...form }),
    })
    const j = await r.json()
    if (!r.ok) { setMsg('Erreur : ' + j.error); setSaving(false); return }
    setForm({}); load(); setSaving(false)
  }

  async function remove(id: string) {
    setDeleting(id)
    await fetch(`/api/config/listes?type=${listKey}&id=${id}`, { method: 'DELETE' })
    setDeleting(null); load()
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h4 style={{ marginBottom: 8, color: 'var(--abed-green)' }}>{label}</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {fields.map(f => (
          <input key={f} className="input" placeholder={f === 'code' ? 'Code (ex: ADM01)' : f === 'libelle' ? 'Libellé' : 'Nom'}
            value={form[f] ?? ''} style={{ maxWidth: 220 }}
            onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))} />
        ))}
        <button className="btn" style={{ fontSize: 13 }} disabled={saving} onClick={add}>
          {saving ? '…' : '+ Ajouter'}
        </button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 8 }}>{msg}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '3px 10px', borderRadius: 999,
            background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
            {itemLabel(item)}
            <button onClick={() => remove(item.id)} disabled={deleting === item.id}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b',
                fontSize: 14, lineHeight: 1, padding: 0 }}>
              {deleting === item.id ? '…' : '×'}
            </button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun élément</span>}
      </div>
    </div>
  )
}

function TauxSection() {
  const [tauxDirect, setTauxDirect] = useState('')
  const [tauxCredit, setTauxCredit] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/config/taux').then(r => r.json()).then(j => {
      setTauxDirect(j.taux_direct ?? '')
      setTauxCredit(j.taux_credit ?? '')
    })
  }, [])

  async function save() {
    if (!tauxDirect || !tauxCredit) { setMsg('Les deux taux sont requis.'); return }
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/taux', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_direct: +tauxDirect, taux_credit: +tauxCredit }),
    })
    const j = await r.json()
    if (!r.ok) setMsg('Erreur : ' + j.error)
    else setMsg('✓ Taux mis à jour')
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <h4 style={{ marginBottom: 8, color: 'var(--abed-green)' }}>Taux horaires (FCFA/heure)</h4>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Prestataire direct</label>
          <input className="input" type="number" min={0} style={{ maxWidth: 180 }}
            value={tauxDirect} onChange={e => setTauxDirect(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">Prestataire à crédit</label>
          <input className="input" type="number" min={0} style={{ maxWidth: 180 }}
            value={tauxCredit} onChange={e => setTauxCredit(e.target.value)} />
        </div>
        <button className="btn" style={{ fontSize: 13 }} disabled={saving} onClick={save}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
      {msg && (
        <p style={{ fontSize: 13, marginTop: 8,
          color: msg.startsWith('✓') ? '#166534' : '#991b1b' }}>{msg}</p>
      )}
    </div>
  )
}

export default function GestionCAF() {
  return (
    <div className="card" style={{ borderLeft: '4px solid #1e40af' }}>
      <h3 style={{ marginBottom: 4 }}>⚙️ Paramètres financiers</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Gérez les taux horaires et les listes utilisées dans les formulaires de demande de paiement.
      </p>

      <TauxSection />

      <hr style={{ margin: '20px 0', borderColor: 'var(--abed-border)' }} />
      <h4 style={{ marginBottom: 16, color: '#374151' }}>Listes du formulaire de demande de paiement</h4>

      {LISTES.map(l => (
        <ListeSection key={l.key} listKey={l.key} label={l.label} fields={l.fields} />
      ))}
    </div>
  )
}
