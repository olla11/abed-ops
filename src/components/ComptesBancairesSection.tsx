'use client'
import { useEffect, useState } from 'react'
import { Banknote, Plus, Trash2 } from 'lucide-react'

type CompteBancaire = { id: string; nom: string; ordre?: number }

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

// Comptes disponibles pour le paiement dans Pay Roll et les appels de fonds
// (ex. "ABED Principal", "CLEE-2i") — éditable depuis les Paramètres CAF et
// RH, tous deux réservés à caf/admin/superadmin pour cette section.
export default function ComptesBancairesSection() {
  const [items, setItems] = useState<CompteBancaire[]>([])
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const r = await fetch('/api/config/listes?type=comptes_bancaires')
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
      body: JSON.stringify({ type: 'comptes_bancaires', nom: nom.trim(), ordre: items.length + 1 }),
    })
    const j = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg('Erreur : ' + j.error); return }
    setNom(''); load()
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce compte ? Les paiements déjà associés garderont son nom en référence.')) return
    await fetch(`/api/config/listes?type=comptes_bancaires&id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Banknote size={16} color="var(--abed-green)" /> Comptes bancaires
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Comptes disponibles pour le paiement dans Pay Roll et les appels de fonds.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{c.nom}</span>
            <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun compte.</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Nouveau compte..." value={nom} onChange={e => setNom(e.target.value)} />
        <button className="btn" style={{ fontSize: 13, padding: '8px 16px' }} onClick={add} disabled={saving}>
          <Plus size={14} /> Ajouter
        </button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{msg}</p>}
    </div>
  )
}
