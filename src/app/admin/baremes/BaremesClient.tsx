'use client'
import { useEffect, useState } from 'react'
import { Coins, Wallet, GraduationCap, Radio } from 'lucide-react'
import { NIVEAU_FONCTION_LABELS, SENIORITE_LABELS, type NiveauFonctionHonoraire, type Seniorite } from '@/lib/bareme'
import { TYPE_EMPLOI_LABELS } from '@/lib/roles'

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box', width: 120,
}
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: 'var(--abed-muted)', textTransform: 'uppercase', letterSpacing: '.03em', padding: '6px 10px' }
const td: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderTop: '1px solid #f3f4f6' }

function Msg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 13, margin: '10px 0',
      background: msg.startsWith('Erreur') ? '#fee2e2' : '#dcfce7',
      color: msg.startsWith('Erreur') ? '#991b1b' : '#166534',
    }}>{msg}</div>
  )
}

const PRIME_TYPE_LABELS: Record<string, string> = {
  paliers_heures: 'Paliers selon heures (voir section Prime de communication)',
  fixe: 'Montant fixe',
  aucune: 'Aucune',
  budget_projet: 'Selon budget projet spécifique',
}

type Honoraire = {
  id: string; niveau_fonction: NiveauFonctionHonoraire; seniorite: Seniorite | null
  type_prestation: string; montant_heure: number
  prime_communication_type: string; prime_communication_fixe: number | null
}

function HonorairesSection() {
  const [rows, setRows] = useState<Honoraire[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function load() {
    fetch('/api/admin/baremes/honoraires').then(r => r.json()).then(j => { setRows(j.data ?? []); setLoading(false) })
  }
  useEffect(load, [])

  function update(id: string, field: keyof Honoraire, value: any) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/baremes/honoraires', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    const j = await res.json()
    setSaving(false)
    setMsg(res.ok ? 'Barème enregistré.' : 'Erreur : ' + j.error)
    if (res.ok) load()
  }

  if (loading) return <div className="card"><p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Coins size={16} color="var(--abed-green)" /> Taux honoraires des prestataires
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Tableau 2 de la politique de rémunération — F CFA / heure, utilisé au calcul du montant à la validation CAF d'un timesheet.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>
            <th style={th}>Niveau de fonction</th><th style={th}>Ancienneté</th><th style={th}>Type</th>
            <th style={th}>F CFA / heure</th><th style={th}>Prime communication</th><th style={th}>Montant fixe (si applicable)</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{NIVEAU_FONCTION_LABELS[r.niveau_fonction]}</td>
                <td style={td}>{r.seniorite ? SENIORITE_LABELS[r.seniorite] : '—'}</td>
                <td style={td}>{r.type_prestation === 'credit' ? 'À crédit' : 'Direct'}</td>
                <td style={td}>
                  <input type="number" style={inputStyle} value={r.montant_heure}
                    onChange={e => update(r.id, 'montant_heure', Number(e.target.value))} />
                </td>
                <td style={td}>
                  <select style={{ ...inputStyle, width: 220 }} value={r.prime_communication_type}
                    onChange={e => update(r.id, 'prime_communication_type', e.target.value)}>
                    {Object.entries(PRIME_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </td>
                <td style={td}>
                  {r.prime_communication_type === 'fixe' ? (
                    <input type="number" style={inputStyle} value={r.prime_communication_fixe ?? 0}
                      onChange={e => update(r.id, 'prime_communication_fixe', Number(e.target.value))} />
                  ) : <span style={{ color: 'var(--abed-muted)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Msg msg={msg} />
      <button className="btn" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer le barème honoraires'}
      </button>
    </div>
  )
}

function PaliersSection() {
  const [p, setP] = useState({ palier1_borne_max: 100, palier1_montant: 15000, palier2_borne_max: 200, palier2_montant: 25000, palier3_montant: 35000 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetch('/api/admin/baremes/paliers').then(r => r.json()).then(j => { setP(j); setLoading(false) }) }, [])

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/baremes/paliers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
    const j = await res.json()
    setSaving(false)
    setMsg(res.ok ? 'Paliers enregistrés.' : 'Erreur : ' + j.error)
  }

  if (loading) return null

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Radio size={16} color="var(--abed-green)" /> Prime de communication — paliers selon heures
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        S'applique aux niveaux marqués « Paliers selon heures » ci-dessus (Directeurs, Programme Lead/Manager, Chargé de Projet), sur le cumul mensuel d'heures retenues.
      </p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label className="label">0 à</label>
          <input type="number" style={inputStyle} value={p.palier1_borne_max} onChange={e => setP({ ...p, palier1_borne_max: Number(e.target.value) })} /></div>
        <div className="field"><label className="label">Prime (F CFA)</label>
          <input type="number" style={inputStyle} value={p.palier1_montant} onChange={e => setP({ ...p, palier1_montant: Number(e.target.value) })} /></div>
        <div className="field"><label className="label">jusqu'à</label>
          <input type="number" style={inputStyle} value={p.palier2_borne_max} onChange={e => setP({ ...p, palier2_borne_max: Number(e.target.value) })} /></div>
        <div className="field"><label className="label">Prime (F CFA)</label>
          <input type="number" style={inputStyle} value={p.palier2_montant} onChange={e => setP({ ...p, palier2_montant: Number(e.target.value) })} /></div>
        <div className="field"><label className="label">Au-delà — Prime (F CFA)</label>
          <input type="number" style={inputStyle} value={p.palier3_montant} onChange={e => setP({ ...p, palier3_montant: Number(e.target.value) })} /></div>
      </div>
      <Msg msg={msg} />
      <button className="btn" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer les paliers'}
      </button>
    </div>
  )
}

type Grille = { id: string; grade: string; echelon: string; salaire_brut: number; prime_diverses: number }

function SalairesSection() {
  const [rows, setRows] = useState<Grille[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function load() {
    fetch('/api/admin/baremes/salaires').then(r => r.json()).then(j => { setRows(j.data ?? []); setLoading(false) })
  }
  useEffect(load, [])

  function update(id: string, field: 'salaire_brut' | 'prime_diverses', value: number) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/baremes/salaires', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
    const j = await res.json()
    setSaving(false)
    setMsg(res.ok ? 'Grille enregistrée.' : 'Erreur : ' + j.error)
    if (res.ok) load()
  }

  if (loading) return <div className="card"><p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  const grades = [...new Set(rows.map(r => r.grade))]

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <GraduationCap size={16} color="var(--abed-green)" /> Grille salariale CDI/CDD
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Tableau 3 — salaire brut mensuel et primes diverses par grade et échelon. Utilisé à la création d'un contrat CDI/CDD.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr><th style={th}>Grade</th><th style={th}>Échelon</th><th style={th}>Salaire brut (F CFA)</th><th style={th}>Primes diverses (F CFA)</th></tr></thead>
          <tbody>
            {grades.map(g => rows.filter(r => r.grade === g).map((r, i) => (
              <tr key={r.id}>
                {i === 0 && <td style={{ ...td, fontWeight: 700 }} rowSpan={4}>{g}</td>}
                <td style={td}>{r.echelon}</td>
                <td style={td}><input type="number" style={inputStyle} value={r.salaire_brut} onChange={e => update(r.id, 'salaire_brut', Number(e.target.value))} /></td>
                <td style={td}><input type="number" style={inputStyle} value={r.prime_diverses} onChange={e => update(r.id, 'prime_diverses', Number(e.target.value))} /></td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <Msg msg={msg} />
      <button className="btn" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer la grille salariale'}
      </button>
    </div>
  )
}

type Allocation = { id: string; type_emploi: string; niveau_fonction: NiveauFonctionHonoraire | null; montant_mensuel: number }

function AllocationsSection() {
  const [rows, setRows] = useState<Allocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function load() {
    fetch('/api/admin/baremes/allocations').then(r => r.json()).then(j => { setRows(j.data ?? []); setLoading(false) })
  }
  useEffect(load, [])

  function update(id: string, value: number) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, montant_mensuel: value } : r))
  }

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/baremes/allocations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
    const j = await res.json()
    setSaving(false)
    setMsg(res.ok ? 'Allocations enregistrées.' : 'Erreur : ' + j.error)
    if (res.ok) load()
  }

  if (loading) return <div className="card"><p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Wallet size={16} color="var(--abed-green)" /> Allocations bénévoles / stagiaires
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
        Tableau 1 — allocation mensuelle de communication/internet. Référence de calcul (pas encore de circuit de paiement dédié pour les bénévoles).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead><tr><th style={th}>Type d'emploi</th><th style={th}>Niveau</th><th style={th}>Allocation mensuelle (F CFA)</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{TYPE_EMPLOI_LABELS[r.type_emploi as keyof typeof TYPE_EMPLOI_LABELS] ?? r.type_emploi}</td>
                <td style={td}>{r.niveau_fonction ? NIVEAU_FONCTION_LABELS[r.niveau_fonction] : '—'}</td>
                <td style={td}><input type="number" style={inputStyle} value={r.montant_mensuel} onChange={e => update(r.id, Number(e.target.value))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Msg msg={msg} />
      <button className="btn" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer les allocations'}
      </button>
    </div>
  )
}

export default function BaremesClient() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Barèmes & rémunération</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Politique de rémunération PG N° 002-25/DE-ABED ONG (adoptée par le CA le 31 juillet 2026) — réservé au CAF.
        </p>
      </div>
      <HonorairesSection />
      <PaliersSection />
      <SalairesSection />
      <AllocationsSection />
    </div>
  )
}
