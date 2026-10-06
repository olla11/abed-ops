'use client'
import { useEffect, useState } from 'react'
import { Settings, Building2, Wallet, Plus, Trash2 } from 'lucide-react'

type Direction = { id: string; nom: string; ordre?: number }
type Tranche = { jusqua: number | null; taux: number }

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

function DirectionsSection() {
  const [items, setItems] = useState<Direction[]>([])
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const r = await fetch('/api/config/listes?type=directions')
    const j = await r.json()
    setItems(j.data ?? [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!nom.trim()) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/listes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'directions', nom: nom.trim(), ordre: items.length + 1 }),
    })
    const j = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg('Erreur : ' + j.error); return }
    setNom(''); load()
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette direction ? Les profils qui la référencent garderont le libellé en texte.')) return
    await fetch(`/api/config/listes?type=directions&id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Building2 size={16} color="var(--abed-green)" /> Directions / Services
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Liste utilisée pour le champ « Direction » du personnel et des contrats.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {items.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{d.nom}</span>
            <button onClick={() => remove(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucune direction.</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Nouvelle direction..." value={nom} onChange={e => setNom(e.target.value)} />
        <button className="btn" style={{ fontSize: 13, padding: '8px 16px' }} onClick={add} disabled={saving}>
          <Plus size={14} /> Ajouter
        </button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{msg}</p>}
    </div>
  )
}

function PaieParametresSection() {
  const [tauxCnss, setTauxCnss] = useState(3.6)
  const [bareme, setBareme] = useState<Tranche[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/rh/parametres-paie').then(r => r.json()).then(j => {
      setTauxCnss(j.taux_cnss_employe ?? 3.6)
      setBareme(j.bareme_its ?? [])
      setLoading(false)
    })
  }, [])

  function updateTranche(i: number, field: keyof Tranche, value: string) {
    setBareme(b => b.map((t, idx) => idx === i
      ? { ...t, [field]: field === 'jusqua' ? (value === '' ? null : Number(value)) : Number(value) }
      : t))
  }

  function addTranche() {
    setBareme(b => [...b.slice(0, -1), { jusqua: b.length ? (b[b.length - 2]?.jusqua ?? 0) + 50000 : 50000, taux: 0 }, b[b.length - 1] ?? { jusqua: null, taux: 0 }])
  }

  function removeTranche(i: number) {
    setBareme(b => b.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/rh/parametres-paie', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_cnss_employe: tauxCnss, bareme_its: bareme }),
    })
    setSaving(false)
    const j = await res.json()
    setMsg(res.ok ? 'Paramètres enregistrés.' : 'Erreur : ' + j.error)
  }

  if (loading) return <div className="card"><p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Wallet size={16} color="var(--abed-green)" /> Paramètres de paie
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 16px' }}>
        Taux de cotisation CNSS employé et barème de l&apos;impôt sur salaire (ITS), utilisés pour le calcul des fiches de paie.
      </p>

      <div className="field" style={{ maxWidth: 220, marginBottom: 20 }}>
        <label className="label">Taux CNSS employé (%)</label>
        <input type="number" step="0.1" style={inputStyle} value={tauxCnss} onChange={e => setTauxCnss(Number(e.target.value))} />
      </div>

      <label className="label" style={{ display: 'block', marginBottom: 8 }}>Barème ITS (tranches progressives)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {bareme.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--abed-muted)', width: 70 }}>Jusqu&apos;à</span>
            {i === bareme.length - 1 ? (
              <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--abed-muted)', width: 140 }}>au-delà</span>
            ) : (
              <input type="number" style={{ ...inputStyle, width: 140 }} value={t.jusqua ?? ''} onChange={e => updateTranche(i, 'jusqua', e.target.value)} />
            )}
            <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>FCFA — taux</span>
            <input type="number" step="0.5" style={{ ...inputStyle, width: 80 }} value={t.taux} onChange={e => updateTranche(i, 'taux', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>%</span>
            {bareme.length > 1 && (
              <button onClick={() => removeTranche(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="btn secondary" style={{ fontSize: 12, marginBottom: 16 }} onClick={addTranche}>
        <Plus size={13} /> Ajouter une tranche
      </button>

      {msg && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14,
          background: msg.startsWith('Erreur') ? '#fee2e2' : '#dcfce7',
          color: msg.startsWith('Erreur') ? '#991b1b' : '#166534',
        }}>{msg}</div>
      )}
      <button className="btn" onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer les paramètres de paie'}
      </button>
    </div>
  )
}

export default function RHParametresClient() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={22} /> Paramètres RH
        </h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Réglages gérés par RH — organigramme et paramètres de calcul de la paie.
        </p>
      </div>
      <DirectionsSection />
      <PaieParametresSection />
    </div>
  )
}
