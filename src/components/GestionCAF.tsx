'use client'
import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ListeItem = { id: string; nom?: string; code?: string; libelle?: string }

type ChampLocal = {
  _key: string          // identifiant local unique (uuid temporaire pour les nouveaux)
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  options: string[]     // pour type=select
  optionsRaw: string    // texte brut séparé par virgules pour l'édition
}

const LISTES = [
  { key: 'departements',      label: 'Départements / Équipes',  fields: ['nom'] },
  { key: 'codes_budgetaires', label: 'Codes budgétaires',        fields: ['code', 'libelle'] },
  { key: 'projets',           label: 'Projets / Programmes',     fields: ['nom'] },
  { key: 'natures',           label: 'Natures de dépense',       fields: ['nom'] },
]

const TYPE_OPTS = [
  { value: 'text',     label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'select',   label: 'Liste déroulante' },
  { value: 'number',   label: 'Nombre' },
]

const CHAMPS_FIXES = [
  { label: 'Nom et prénom complets',             type: 'text' },
  { label: 'Adresse email',                      type: 'text' },
  { label: 'Département / Équipe',               type: 'select' },
  { label: 'Objet de la dépense',                type: 'textarea' },
  { label: 'Code budgétaire',                    type: 'select' },
  { label: 'Projet / Programme',                 type: 'select' },
  { label: 'Nature de la dépense',               type: 'select' },
  { label: 'Montant demandé (FCFA)',             type: 'number' },
  { label: 'Mode de paiement',                   type: 'select' },
  { label: 'Fournisseur / Bénéficiaire',         type: 'text' },
  { label: 'Référence pièce justificative',      type: 'text' },
  { label: 'Justification de la demande',        type: 'textarea' },
  { label: "Niveau d'urgence",                   type: 'select' },
  { label: 'Date souhaitée de paiement',         type: 'date' },
  { label: 'Pièce justificative (fichier)',       type: 'file' },
]

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Sous-composant : liste configurable ─────────────────────────────────────

function ListeSection({ listKey, label, fields }: { listKey: string; label: string; fields: string[] }) {
  const [items, setItems] = useState<ListeItem[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function itemLabel(item: ListeItem) {
    return item.code ? `${item.code} — ${item.libelle}` : (item.nom ?? '—')
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
    if (!(await r.json()).ok && !r.ok) { setMsg('Erreur'); setSaving(false); return }
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
    const j = await r.json()
    setMsg(r.ok ? '✓ Taux mis à jour' : 'Erreur : ' + j.error)
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

// ── Éditeur complet du formulaire de demande ─────────────────────────────────

function EditeurFormulaire() {
  const [champs, setChamps] = useState<ChampLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [dirty, setDirty] = useState(false)

  async function load() {
    const r = await fetch('/api/config/champs-demande')
    const data = (await r.json()).data ?? []
    setChamps(data.map((c: any) => ({
      _key: uid(),
      label: c.label,
      type: c.type,
      required: c.required,
      options: c.options ?? [],
      optionsRaw: (c.options ?? []).join(', '),
    })))
    setLoading(false)
    setDirty(false)
  }

  useEffect(() => { load() }, [])

  function update(key: string, patch: Partial<ChampLocal>) {
    setChamps(cs => cs.map(c => c._key === key ? { ...c, ...patch } : c))
    setDirty(true)
  }

  function addChamp() {
    setChamps(cs => [...cs, { _key: uid(), label: '', type: 'text', required: false, options: [], optionsRaw: '' }])
    setDirty(true)
  }

  function remove(key: string) {
    setChamps(cs => cs.filter(c => c._key !== key))
    setDirty(true)
  }

  function move(key: string, dir: -1 | 1) {
    setChamps(cs => {
      const idx = cs.findIndex(c => c._key === key)
      if (idx + dir < 0 || idx + dir >= cs.length) return cs
      const next = [...cs]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
    setDirty(true)
  }

  async function save() {
    for (const c of champs) {
      if (!c.label.trim()) { setMsg({ text: 'Tous les champs doivent avoir un libellé.', ok: false }); return }
      if (c.type === 'select' && !c.optionsRaw.trim()) {
        setMsg({ text: `Le champ "${c.label}" (liste) doit avoir au moins une option.`, ok: false }); return
      }
    }
    setSaving(true); setMsg(null)
    const payload = champs.map((c, i) => ({
      label: c.label.trim(),
      type: c.type,
      required: c.required,
      options: c.type === 'select' ? c.optionsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      ordre: i,
    }))
    const r = await fetch('/api/config/champs-demande', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champs: payload }),
    })
    const j = await r.json()
    if (r.ok) {
      setMsg({ text: '✓ Formulaire mis à jour pour tous les utilisateurs.', ok: true })
      setDirty(false)
      load()
    } else {
      setMsg({ text: 'Erreur : ' + j.error, ok: false })
    }
    setSaving(false)
  }

  if (loading) return <p style={{ color: 'var(--abed-muted)', fontSize: 13 }}>Chargement…</p>

  return (
    <div>
      {/* Rappel des champs fixes */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
          Champs fixes du formulaire (non modifiables — structure de base)
        </p>
        <div style={{ display: 'grid', gap: 4 }}>
          {CHAMPS_FIXES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 12px', background: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: 6,
              fontSize: 13, color: '#6b7280',
            }}>
              <span style={{ fontSize: 11, background: '#e5e7eb', padding: '1px 6px', borderRadius: 4, minWidth: 20, textAlign: 'center' }}>
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.type}</span>
              <span style={{ fontSize: 10, color: '#d1d5db', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 5px' }}>fixe</span>
            </div>
          ))}
        </div>
      </div>

      <hr style={{ borderColor: 'var(--abed-border)', marginBottom: 20 }} />

      {/* Éditeur des champs personnalisés */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--abed-green)', margin: 0 }}>
            Questions supplémentaires ({champs.length})
          </p>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '2px 0 0' }}>
            Ces champs s'ajoutent après les champs fixes pour tous les utilisateurs.
          </p>
        </div>
        <button onClick={addChamp} className="btn secondary" style={{ fontSize: 13 }}>
          + Ajouter une question
        </button>
      </div>

      {champs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--abed-muted)', fontSize: 13,
          background: '#f9fafb', borderRadius: 8, border: '1px dashed var(--abed-border)', marginBottom: 16 }}>
          Aucune question supplémentaire. Cliquez sur "+ Ajouter une question" pour commencer.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {champs.map((c, i) => (
          <div key={c._key} style={{
            background: 'white', border: '1px solid var(--abed-border)',
            borderLeft: '4px solid var(--abed-green)',
            borderRadius: 8, padding: '14px 16px',
          }}>
            {/* En-tête de la ligne */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {/* Numéro */}
              <span style={{
                fontSize: 11, fontWeight: 700, background: 'var(--abed-green)', color: 'white',
                borderRadius: 4, padding: '2px 7px', minWidth: 28, textAlign: 'center',
              }}>
                {CHAMPS_FIXES.length + i + 1}
              </span>

              {/* Boutons haut/bas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button onClick={() => move(c._key, -1)} disabled={i === 0}
                  style={{ fontSize: 10, lineHeight: 1, padding: '2px 5px', background: '#f3f4f6',
                    border: '1px solid #e5e7eb', borderRadius: 3, cursor: i === 0 ? 'not-allowed' : 'pointer',
                    opacity: i === 0 ? 0.4 : 1 }}>▲</button>
                <button onClick={() => move(c._key, 1)} disabled={i === champs.length - 1}
                  style={{ fontSize: 10, lineHeight: 1, padding: '2px 5px', background: '#f3f4f6',
                    border: '1px solid #e5e7eb', borderRadius: 3,
                    cursor: i === champs.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: i === champs.length - 1 ? 0.4 : 1 }}>▼</button>
              </div>

              {/* Label (pleine largeur) */}
              <input
                className="input"
                placeholder="Libellé de la question *"
                value={c.label}
                onChange={e => update(c._key, { label: e.target.value })}
                style={{ flex: 1, fontWeight: 600 }}
              />

              {/* Supprimer */}
              <button onClick={() => remove(c._key)}
                style={{ padding: '6px 10px', fontSize: 13, background: 'none',
                  border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 6, cursor: 'pointer',
                  flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Options de configuration */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', paddingLeft: 72 }}>
              {/* Type */}
              <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                <label className="label" style={{ fontSize: 11 }}>Type de réponse</label>
                <select className="select" value={c.type}
                  onChange={e => update(c._key, { type: e.target.value as ChampLocal['type'] })}>
                  {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Options pour select */}
              {c.type === 'select' && (
                <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                  <label className="label" style={{ fontSize: 11 }}>Options (séparées par des virgules)</label>
                  <input className="input" placeholder="Option A, Option B, Option C"
                    value={c.optionsRaw}
                    onChange={e => update(c._key, { optionsRaw: e.target.value })} />
                </div>
              )}

              {/* Obligatoire */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                marginTop: 22, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={c.required}
                  onChange={e => update(c._key, { required: e.target.checked })} />
                Obligatoire
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Barre de sauvegarde */}
      <div style={{
        position: 'sticky', bottom: 0, background: 'white',
        borderTop: dirty ? '2px solid var(--abed-green)' : '2px solid transparent',
        padding: '14px 0', display: 'flex', alignItems: 'center', gap: 16,
        transition: 'border-color .2s',
      }}>
        <button
          className="btn"
          onClick={save}
          disabled={saving || !dirty}
          style={{ fontSize: 14, padding: '10px 28px', opacity: dirty ? 1 : 0.5 }}>
          {saving ? '⏳ Enregistrement…' : '💾 Mettre à jour pour tous'}
        </button>
        {dirty && !saving && (
          <span style={{ fontSize: 13, color: '#92660b' }}>
            ⚠️ Modifications non enregistrées
          </span>
        )}
        {msg && (
          <span style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? '#166534' : '#991b1b' }}>
            {msg.text}
          </span>
        )}
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
        Configurez les taux horaires, les listes déroulantes et les questions du formulaire de demande de paiement.
      </p>

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

      {subTab === 'formulaire' && <EditeurFormulaire />}
    </div>
  )
}
