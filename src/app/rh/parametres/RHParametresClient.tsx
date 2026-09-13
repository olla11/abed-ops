'use client'
import { useEffect, useRef, useState } from 'react'
import { Settings, Building2, Wallet, Plus, Trash2, Banknote, PiggyBank } from 'lucide-react'

type Direction = { id: string; nom: string; ordre?: number }
type Tranche = { jusqua: number | null; taux: number }
type CompteBancaire = { id: string; nom: string; ordre?: number }
type LigneBudget = { code: string; libelle: string; montant_annuel: number }

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

function ComptesBancairesSection() {
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

function BudgetAdopteSection() {
  const anneeCourante = new Date().getFullYear()
  const [annee, setAnnee] = useState(anneeCourante)
  const [lignes, setLignes] = useState<LigneBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function load(a: number) {
    setLoading(true)
    fetch(`/api/budget-adopte?annee=${a}`).then(r => r.json()).then(j => setLignes(j.data ?? [])).finally(() => setLoading(false))
  }
  useEffect(() => { load(annee) }, [annee])

  function updateMontant(code: string, valeur: string) {
    setLignes(ls => ls.map(l => l.code === code ? { ...l, montant_annuel: Number(valeur) || 0 } : l))
  }

  async function save(code: string, montant_annuel: number) {
    setSavingCode(code)
    await fetch('/api/budget-adopte', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annee, code_budgetaire: code, montant_annuel }),
    })
    setSavingCode(null)
  }

  async function importerFichier(file: File) {
    setImporting(true); setImportMsg('')
    const form = new FormData()
    form.append('file', file)
    form.append('annee', String(annee))
    const res = await fetch('/api/budget-adopte/import', { method: 'POST', body: form })
    const j = await res.json()
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res.ok) { setImportMsg('Erreur : ' + j.error); return }
    setImportMsg(`${j.importes} ligne(s) importée(s)${j.ignores?.length ? ` — ignoré(es) : ${j.ignores.join(', ')}` : ''}.`)
    load(annee)
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PiggyBank size={16} color="var(--abed-green)" /> Budget adopté par ligne budgétaire
        </h3>
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={{ ...inputStyle, width: 100 }}>
          {[anneeCourante - 1, anneeCourante, anneeCourante + 1, anneeCourante + 2].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Montant annuel adopté par le CA pour chaque code budgétaire — sert à calculer la réalisation
        cumulée et la disponibilité sur les appels de fonds et l&apos;exécution financière.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
        <a href={`/api/budget-adopte/template?annee=${annee}`} className="btn secondary" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          Télécharger le modèle {annee}
        </a>
        <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>puis</span>
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importerFichier(f) }} />
        <button className="btn" style={{ fontSize: 12.5 }} onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? 'Import…' : 'Importer le fichier complété'}
        </button>
      </div>
      {importMsg && <p style={{ fontSize: 12, color: importMsg.startsWith('Erreur') ? '#dc2626' : '#166534', marginBottom: 12 }}>{importMsg}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lignes.map(l => {
            const estRubrique = l.code.endsWith('00')
            return (
              <div key={l.code} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8,
                background: estRubrique ? '#f0fdf4' : '#f9fafb',
              }}>
                <span style={{ fontSize: 11, color: 'var(--abed-muted)', width: 56, fontWeight: estRubrique ? 800 : 400 }}>{l.code}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: estRubrique ? 800 : 400, color: estRubrique ? 'var(--abed-green)' : '#111827', textTransform: estRubrique ? 'uppercase' : 'none' }}>{l.libelle}</span>
                <input
                  type="number" style={{ ...inputStyle, width: 140, textAlign: 'right' }}
                  value={l.montant_annuel} onChange={e => updateMontant(l.code, e.target.value)}
                  onBlur={e => save(l.code, Number(e.target.value) || 0)}
                  disabled={savingCode === l.code}
                />
                <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>FCFA</span>
              </div>
            )
          })}
          {lignes.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun code budgétaire.</p>}
        </div>
      )}
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

export default function RHParametresClient({ role }: { role?: string } = {}) {
  const estCafOuAdmin = ['caf', 'admin', 'superadmin'].includes(role ?? '')
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
      {estCafOuAdmin && (
        <>
          <ComptesBancairesSection />
          <BudgetAdopteSection />
        </>
      )}
    </div>
  )
}
