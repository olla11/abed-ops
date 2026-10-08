'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

type Liste = { id: string; nom?: string; code?: string; libelle?: string }
type Ligne = { designation: string; quantite: string; montant_estime: string; reference: string }

const LIGNE_VIDE: Ligne = { designation: '', quantite: '', montant_estime: '', reference: '' }

export default function ExpressionBesoinForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ projet_service: '', nature_depense: '', code_budgetaire: '', ref_tdr: '' })
  const [lignes, setLignes] = useState<Ligne[]>([{ ...LIGNE_VIDE }])
  const [codes, setCodes] = useState<Liste[]>([])
  const [natures, setNatures] = useState<Liste[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [numero, setNumero] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/config/listes?type=codes_budgetaires').then(r => r.json()),
      fetch('/api/config/listes?type=natures').then(r => r.json()),
    ]).then(([c, n]) => { setCodes(c.data ?? []); setNatures(n.data ?? []) })
  }, [])

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function setLigne(i: number, k: keyof Ligne, v: string) {
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }
  function addLigne() { setLignes(ls => [...ls, { ...LIGNE_VIDE }]) }
  function removeLigne(i: number) { setLignes(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls) }

  const total = lignes.reduce((sum, l) => sum + (Number(l.montant_estime) || 0), 0)

  async function submit() {
    if (!form.projet_service.trim()) { setMsg('Le projet / service demandeur est obligatoire.'); return }
    if (!form.nature_depense) { setMsg('La nature de la dépense est obligatoire.'); return }
    if (!form.code_budgetaire) { setMsg('Le code budgétaire est obligatoire.'); return }
    const lignesValides = lignes.filter(l => l.designation.trim())
    if (lignesValides.length === 0) { setMsg('Au moins une ligne de besoin (désignation) est requise.'); return }

    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/expressions-besoin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lignes: lignesValides.map(l => ({ ...l, montant_estime: Number(l.montant_estime) || 0 })),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); setLoading(false); return }
      setNumero(json.numero ?? null)
      setDone(true)
    } catch (e: any) { setMsg('Erreur : ' + e.message) }
    finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h3 style={{ color: '#166534' }}>Expression de besoin soumise avec succès !</h3>
      {numero && (
        <p style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#374151', marginBottom: 8 }}>
          N° {numero}
        </p>
      )}
      <p style={{ color: 'var(--abed-muted)', marginBottom: 20 }}>
        Votre fiche a été transmise à l'AAF. Vous recevrez un email à chaque étape.
      </p>
      <button className="btn" onClick={onClose}>Fermer</button>
    </div>
  )

  return (
    <div style={{ maxHeight: '82vh', overflowY: 'auto', padding: '4px 2px' }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Fiche d'expression de besoin</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Décrivez le besoin et son coût estimé. Elle sera transmise à l'AAF puis à la Directrice Exécutive.
      </p>

      <div className="field">
        <label className="label">Projet / Service demandeur *</label>
        <input className="input" value={form.projet_service} onChange={e => set('projet_service', e.target.value)}
          placeholder="ex : Projet JFAII Élevage, ou Direction Administration & Finances" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label className="label">Nature de la dépense *</label>
          <select className="select" value={form.nature_depense} onChange={e => set('nature_depense', e.target.value)}>
            <option value="">— Sélectionner —</option>
            {natures.map(n => <option key={n.id} value={n.nom!}>{n.nom}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Ligne / Code budgétaire *</label>
          <select className="select" value={form.code_budgetaire} onChange={e => set('code_budgetaire', e.target.value)}>
            <option value="">— Sélectionner —</option>
            {codes.map(c => <option key={c.id} value={c.code!}>{c.code} — {c.libelle}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Réf. TDR (facultatif)</label>
        <input className="input" value={form.ref_tdr} onChange={e => set('ref_tdr', e.target.value)}
          placeholder="ex : TDR-2026-012" />
      </div>

      <label className="label" style={{ display: 'block', margin: '18px 0 8px' }}>Détail des besoins *</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {lignes.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.3fr auto', gap: 8, alignItems: 'start' }}>
            <input className="input" style={{ fontSize: 13 }} placeholder="Désignation" value={l.designation}
              onChange={e => setLigne(i, 'designation', e.target.value)} />
            <input className="input" style={{ fontSize: 13 }} placeholder="Quantité" value={l.quantite}
              onChange={e => setLigne(i, 'quantite', e.target.value)} />
            <input className="input" style={{ fontSize: 13 }} type="number" placeholder="Montant estimé" value={l.montant_estime}
              onChange={e => setLigne(i, 'montant_estime', e.target.value)} />
            <input className="input" style={{ fontSize: 13 }} placeholder="Référence" value={l.reference}
              onChange={e => setLigne(i, 'reference', e.target.value)} />
            <button onClick={() => removeLigne(i)} disabled={lignes.length === 1}
              style={{ background: 'none', border: 'none', cursor: lignes.length === 1 ? 'not-allowed' : 'pointer', color: '#dc2626', opacity: lignes.length === 1 ? 0.3 : 1, padding: 8 }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn secondary" style={{ fontSize: 12.5, marginBottom: 16 }} onClick={addLigne}>
        <Plus size={14} /> Ajouter une ligne
      </button>

      <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 800, color: 'var(--abed-green)', marginBottom: 16 }}>
        TOTAL : {total.toLocaleString('fr-FR')} FCFA
      </div>

      {msg && (
        <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: '#fee2e2', color: '#991b1b' }}>{msg}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? '⏳ Envoi…' : 'Soumettre la fiche'}
        </button>
        <button className="btn secondary" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
