'use client'
import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ListeItem = { id: string; nom?: string; code?: string; libelle?: string }
type ChampDemande = {
  id: string; label: string; type: string; required: boolean
  options: string[]; ordre: number
}

const LISTES = [
  { key: 'departements',      label: 'Départements / Équipes',  fields: ['nom'] },
  { key: 'codes_budgetaires', label: 'Codes budgétaires',        fields: ['code', 'libelle'] },
  { key: 'projets',           label: 'Projets / Programmes',     fields: ['nom'] },
  { key: 'natures',           label: 'Natures de dépense',       fields: ['nom'] },
]

const CHAMPS_FIXES = [
  'Nom et prénom complets', 'Adresse email', 'Département / Équipe',
  'Objet de la dépense', 'Code budgétaire', 'Projet / Programme',
  'Nature de la dépense', 'Montant demandé (FCFA)', 'Mode de paiement',
  'Fournisseur / Bénéficiaire', 'Référence pièce justificative',
  'Justification de la demande', "Niveau d'urgence", 'Date souhaitée de paiement',
  'Pièce justificative (fichier)',
]

const TYPE_LABELS: Record<string, string> = {
  text: 'Texte court', textarea: 'Texte long', select: 'Liste déroulante', number: 'Nombre',
}

// ── Sous-composant : liste configurable ─────────────────────────────────────

function ListeSection({ listKey, label, fields }: { listKey: string; label: string; fields: string[] }) {
  const [items, setItems] = useState<ListeItem[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function itemLabel(item: ListeItem) {
    if (item.code) return `${item.code} — ${item.libelle}`
    return item.nom ?? '—'
  }

  async function load() {
    const r = await fetch(`/api/config/listes?type=${listKey}`)
    setItems((await r.json()).data ?? [])
  }

  useEffect(() => { load() }, [])

  async function add() {
    for (const f of fields) {
      if (!form[f]?.trim()) { setMsg(`Champ requis : ${f}`); return }
    }
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/listes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      <h4 style={{ marginBottom: 8, color: 'var(--abed-green)', fontSize: 14 }}>{label}</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {fields.map(f => (
          <input key={f} className="input"
            placeholder={f === 'code' ? 'Code (ex: ADM01)' : f === 'libelle' ? 'Libellé' : 'Nom'}
            value={form[f] ?? ''} style={{ maxWidth: 220 }}
            onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
        ))}
        <button className="btn" style={{ fontSize: 13 }} disabled={saving} onClick={add}>
          {saving ? '…' : '+ Ajouter'}
        </button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 8 }}>{msg}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => (
          <span key={item.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            padding: '3px 10px', borderRadius: 999, background: '#f3f4f6', border: '1px solid #e5e7eb',
          }}>
            {itemLabel(item)}
            <button onClick={() => remove(item.id)} disabled={deleting === item.id}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 14, lineHeight: 1, padding: 0 }}>
              {deleting === item.id ? '…' : '×'}
            </button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun élément</span>}
      </div>
    </div>
  )
}

// ── Sous-composant : taux horaires ───────────────────────────────────────────

function TauxSection() {
  const [tauxDirect, setTauxDirect] = useState('')
  const [tauxCredit, setTauxCredit] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/config/taux').then(r => r.json()).then(j => {
      setTauxDirect(j.taux_direct ?? ''); setTauxCredit(j.taux_credit ?? '')
    })
  }, [])

  async function save() {
    if (!tauxDirect || !tauxCredit) { setMsg('Les deux taux sont requis.'); return }
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/taux', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_direct: +tauxDirect, taux_credit: +tauxCredit }),
    })
    setMsg((await r.json()).error ? 'Erreur' : '✓ Taux mis à jour')
    setSaving(false)
  }

  return (
    <div>
      <h4 style={{ marginBottom: 6, color: 'var(--abed-green)', fontSize: 14 }}>Taux horaires (FCFA/heure)</h4>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
        Utilisés pour le calcul automatique des montants dans les timesheets et compteurs crédit.
      </p>
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
      {msg && <p style={{ fontSize: 13, marginTop: 8, color: msg.startsWith('✓') ? '#166534' : '#991b1b' }}>{msg}</p>}
    </div>
  )
}

// ── Sous-composant : champs personnalisés du formulaire de demande ────────────

function ChampsDemandeSection() {
  const [champs, setChamps] = useState<ChampDemande[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // Nouveau champ
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('text')
  const [newRequired, setNewRequired] = useState(false)
  const [newOptions, setNewOptions] = useState('') // CSV pour select

  // Édition
  const [editLabel, setEditLabel] = useState('')
  const [editRequired, setEditRequired] = useState(false)
  const [editOptions, setEditOptions] = useState('')

  async function load() {
    const r = await fetch('/api/config/champs-demande')
    setChamps((await r.json()).data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!newLabel.trim()) { setMsg('Le libellé est requis.'); return }
    if (newType === 'select' && !newOptions.trim()) { setMsg('Saisissez au moins une option (séparées par des virgules).'); return }
    setSaving(true); setMsg('')
    const options = newType === 'select' ? newOptions.split(',').map(s => s.trim()).filter(Boolean) : []
    const r = await fetch('/api/config/champs-demande', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, type: newType, required: newRequired, options, ordre: champs.length }),
    })
    if (!r.ok) { setMsg('Erreur : ' + (await r.json()).error); setSaving(false); return }
    setNewLabel(''); setNewType('text'); setNewRequired(false); setNewOptions('')
    load(); setSaving(false)
  }

  async function startEdit(c: ChampDemande) {
    setEditing(c.id)
    setEditLabel(c.label)
    setEditRequired(c.required)
    setEditOptions((c.options ?? []).join(', '))
  }

  async function saveEdit(id: string) {
    const c = champs.find(x => x.id === id)!
    const options = c.type === 'select' ? editOptions.split(',').map(s => s.trim()).filter(Boolean) : c.options
    setSaving(true)
    await fetch('/api/config/champs-demande', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label: editLabel, required: editRequired, options }),
    })
    setEditing(null); load(); setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce champ ? Les demandes existantes conservent leurs données.')) return
    await fetch(`/api/config/champs-demande?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      {/* Champs fixes (lecture seule) */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 8, color: '#374151', fontSize: 14 }}>Champs fixes (non modifiables)</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHAMPS_FIXES.map(f => (
            <span key={f} style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 999,
              background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280',
            }}>{f}</span>
          ))}
        </div>
      </div>

      <hr style={{ borderColor: 'var(--abed-border)', marginBottom: 20 }} />

      {/* Champs personnalisés existants */}
      <h4 style={{ marginBottom: 12, color: 'var(--abed-green)', fontSize: 14 }}>
        Champs personnalisés ({champs.length})
      </h4>

      {loading ? <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p> : (
        champs.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>Aucun champ personnalisé pour le moment.</p>
          : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              {champs.map((c, i) => (
                <div key={c.id} style={{
                  background: '#f9fafb', border: '1px solid var(--abed-border)',
                  borderRadius: 8, padding: '12px 16px',
                }}>
                  {editing === c.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input className="input" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        placeholder="Libellé du champ" />
                      {c.type === 'select' && (
                        <input className="input" value={editOptions}
                          onChange={e => setEditOptions(e.target.value)}
                          placeholder="Options séparées par des virgules" />
                      )}
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} />
                        Champ obligatoire
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" style={{ fontSize: 12 }} disabled={saving}
                          onClick={() => saveEdit(c.id)}>Enregistrer</button>
                        <button className="btn secondary" style={{ fontSize: 12 }}
                          onClick={() => setEditing(null)}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {i + 1 + CHAMPS_FIXES.length}. {c.label}
                          {c.required && <span style={{ color: '#991b1b', marginLeft: 4 }}>*</span>}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--abed-muted)', marginLeft: 10 }}>
                          {TYPE_LABELS[c.type] ?? c.type}
                          {c.type === 'select' && c.options?.length > 0 && ` — ${c.options.join(', ')}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => startEdit(c)}>Modifier</button>
                        <button onClick={() => remove(c.id)}
                          style={{ fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid #fca5a5',
                            color: '#991b1b', borderRadius: 6, cursor: 'pointer' }}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
      )}

      {/* Ajouter un champ */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16 }}>
        <h4 style={{ marginBottom: 12, color: 'var(--abed-green)', fontSize: 14 }}>+ Ajouter un champ</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Libellé de la question *</label>
            <input className="input" placeholder="ex : Numéro de compte bancaire"
              value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Type de champ *</label>
            <select className="select" value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="text">Texte court</option>
              <option value="textarea">Texte long</option>
              <option value="select">Liste déroulante</option>
              <option value="number">Nombre</option>
            </select>
          </div>
        </div>
        {newType === 'select' && (
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="label">Options (séparées par des virgules) *</label>
            <input className="input" placeholder="Option A, Option B, Option C"
              value={newOptions} onChange={e => setNewOptions(e.target.value)} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} />
            Champ obligatoire
          </label>
          <button className="btn" style={{ fontSize: 13 }} disabled={saving} onClick={add}>
            {saving ? '⏳ Ajout…' : 'Ajouter ce champ'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 13, color: '#991b1b', marginTop: 8 }}>{msg}</p>}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

type SubTab = 'taux' | 'listes' | 'formulaire'

export default function GestionCAF() {
  const [subTab, setSubTab] = useState<SubTab>('taux')

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'taux',       label: 'Taux horaires' },
    { key: 'listes',     label: 'Listes déroulantes' },
    { key: 'formulaire', label: 'Formulaire de demande' },
  ]

  return (
    <div className="card" style={{ borderLeft: '4px solid #1e40af' }}>
      <h3 style={{ marginBottom: 4 }}>⚙️ Paramètres financiers & formulaires</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Configurez les taux, les listes déroulantes et les questions du formulaire de demande de paiement.
      </p>

      {/* Sous-onglets */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--abed-border)', marginBottom: 24 }}>
        {subTabs.map(t => {
          const active = t.key === subTab
          return (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#1e40af' : 'var(--abed-muted)',
                background: 'none', border: 'none',
                borderBottom: active ? '3px solid #1e40af' : '3px solid transparent',
                marginBottom: -2, cursor: 'pointer', transition: 'color .15s',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'taux' && <TauxSection />}

      {subTab === 'listes' && (
        <div>
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13,
          }}>
            <strong>Ces listes sont partagées</strong> entre le formulaire de timesheet et le formulaire de demande de paiement.
          </div>
          {LISTES.map(l => (
            <ListeSection key={l.key} listKey={l.key} label={l.label} fields={l.fields} />
          ))}
        </div>
      )}

      {subTab === 'formulaire' && <ChampsDemandeSection />}
    </div>
  )
}
