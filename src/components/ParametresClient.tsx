'use client'
import { useState, useEffect } from 'react'
import FormulaireEditor from '@/components/FormulaireEditor'

// ─── Types ───────────────────────────────────────────────────────────────────

type Item = { id: string; nom?: string; code?: string; libelle?: string }

const LISTES = [
  { key: 'departements',      label: 'Départements / Équipes',  icon: '🏢', fields: ['nom'] as string[] },
  { key: 'codes_budgetaires', label: 'Codes budgétaires',        icon: '📊', fields: ['code', 'libelle'] as string[] },
  { key: 'projets',           label: 'Projets / Programmes',     icon: '📁', fields: ['nom'] as string[] },
  { key: 'natures',           label: 'Natures de dépense',       icon: '🏷️', fields: ['nom'] as string[] },
]

// ─── Sous-composant : une liste éditable ─────────────────────────────────────

function ListeSection({ listKey, label, icon, fields }: { listKey: string; label: string; icon: string; fields: string[] }) {
  const [items, setItems] = useState<Item[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  function itemLabel(item: Item) {
    if (item.code) return `${item.code} — ${item.libelle}`
    return item.nom ?? '—'
  }

  async function load() {
    const r = await fetch(`/api/config/listes?type=${listKey}`)
    const j = await r.json()
    setItems(j.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function add() {
    for (const f of fields) {
      if (!form[f]?.trim()) { setMsg(`Champ requis`); return }
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
    if (!confirm('Supprimer cet élément ?')) return
    setDeleting(id)
    await fetch(`/api/config/listes?type=${listKey}&id=${id}`, { method: 'DELETE' })
    setDeleting(null); load()
  }

  function startEdit(item: Item) {
    setEditId(item.id)
    setEditForm({ nom: item.nom ?? '', code: item.code ?? '', libelle: item.libelle ?? '' })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch(`/api/config/listes?type=${listKey}&id=${id}`, { method: 'DELETE' })
    await fetch('/api/config/listes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: listKey, ...editForm }),
    })
    setSaving(false); setEditId(null); load()
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--abed-border)', display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{label}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{items.length} élément{items.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {fields.map(f => (
          <div key={f} style={{ flex: f === 'libelle' ? 2 : 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              {f === 'code' ? 'Code' : f === 'libelle' ? 'Libellé' : 'Nom'}
            </label>
            <input className="input" style={{ fontSize: 13 }}
              placeholder={f === 'code' ? 'ex: ADM01' : f === 'libelle' ? 'Description' : `Nouveau ${label.toLowerCase()}`}
              value={form[f] ?? ''}
              onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
          </div>
        ))}
        <button onClick={add} disabled={saving}
          style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', flexShrink: 0, height: 40 }}>
          {saving ? '…' : '+ Ajouter'}
        </button>
        {msg && <span style={{ fontSize: 12, color: '#991b1b', alignSelf: 'center' }}>{msg}</span>}
      </div>

      {/* Liste des éléments */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, padding: '8px 0' }}>Aucun élément. Ajoutez le premier ci-dessus.</p>
        ) : items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: editId === item.id ? '#eff6ff' : '#f9fafb', border: `1px solid ${editId === item.id ? '#bfdbfe' : '#f3f4f6'}` }}>
            {editId === item.id ? (
              <>
                {fields.map(f => (
                  <input key={f} className="input" style={{ fontSize: 13, flex: f === 'libelle' ? 2 : 1, minWidth: 120 }}
                    value={editForm[f] ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))} />
                ))}
                <button onClick={() => saveEdit(item.id)} disabled={saving}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Valider
                </button>
                <button onClick={() => setEditId(null)}
                  style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{itemLabel(item)}</span>
                <button onClick={() => startEdit(item)}
                  style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  ✏️ Modifier
                </button>
                <button onClick={() => remove(item.id)} disabled={deleting === item.id}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                  {deleting === item.id ? '…' : '🗑 Supprimer'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sous-composant : Taux horaires ─────────────────────────────────────────

function TauxSection() {
  const [tauxDirect, setTauxDirect] = useState('')
  const [tauxCredit, setTauxCredit] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/config/taux').then(r => r.json()).then(j => {
      setTauxDirect(String(j.taux_direct ?? ''))
      setTauxCredit(String(j.taux_credit ?? ''))
    })
  }, [])

  async function save() {
    if (!tauxDirect || !tauxCredit) { setMsg('Les deux taux sont requis'); return }
    setSaving(true); setMsg('')
    const r = await fetch('/api/config/taux', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_direct: +tauxDirect, taux_credit: +tauxCredit }),
    })
    const j = await r.json()
    setSaving(false)
    setMsg(r.ok ? '✓ Enregistré' : 'Erreur : ' + j.error)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[
        { key: 'direct', label: 'Prestataire direct', val: tauxDirect, set: setTauxDirect, color: '#166534', bg: '#dcfce7' },
        { key: 'credit', label: 'Prestataire à crédit', val: tauxCredit, set: setTauxCredit, color: '#1e40af', bg: '#dbeafe' },
      ].map(t => (
        <div key={t.key} style={{ background: t.bg, borderRadius: 12, padding: '20px 24px', border: `1px solid ${t.color}22` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={0} step={50} value={t.val}
              onChange={e => t.set(e.target.value)}
              style={{ flex: 1, border: `1px solid ${t.color}44`, borderRadius: 8, padding: '10px 14px', fontSize: 20, fontWeight: 800, color: t.color, background: 'white', outline: 'none', maxWidth: 160 }} />
            <span style={{ fontSize: 13, color: t.color, fontWeight: 600 }}>FCFA/h</span>
          </div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={save} disabled={saving}
          style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? '⏳ Enregistrement…' : '💾 Enregistrer les taux'}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✓') ? '#166534' : '#991b1b' }}>{msg}</span>}
      </div>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

type Tab = 'taux' | 'listes' | 'formulaire'

const TABS: { key: Tab; label: string; icon: string; desc: string }[] = [
  { key: 'taux',       label: 'Taux horaires',   icon: '💰', desc: 'Taux de facturation par type de prestataire' },
  { key: 'listes',     label: 'Listes',           icon: '📋', desc: 'Départements, codes budgétaires, projets, natures' },
  { key: 'formulaire', label: 'Formulaire',       icon: '📝', desc: 'Structure du formulaire de demande de paiement' },
]

export default function ParametresClient() {
  const [tab, setTab] = useState<Tab>('taux')
  const active = TABS.find(t => t.key === tab)!

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: 'var(--abed-green)', margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Paramètres</h1>
        <p style={{ fontSize: 14, color: 'var(--abed-muted)', margin: 0 }}>
          Configuration financière et structure des formulaires de demande de paiement.
        </p>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'var(--abed-green)' : 'white',
              color: tab === t.key ? 'white' : '#374151',
              border: tab === t.key ? '2px solid var(--abed-green)' : '2px solid var(--abed-border)',
              borderRadius: 12, padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
              transition: 'all .15s',
              boxShadow: tab === t.key ? '0 4px 14px rgba(45,122,49,.25)' : '0 1px 3px rgba(0,0,0,.05)',
            }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
            <div style={{ fontSize: 12, opacity: tab === t.key ? 0.85 : 0.6, marginTop: 3 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Contenu de l'onglet ── */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--abed-border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        {/* Header du contenu */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--abed-border)', background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{active.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{active.label}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{active.desc}</div>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>

          {tab === 'taux' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Ces taux sont utilisés par la CAF pour calculer automatiquement le montant à payer lors de la validation des timesheets prestataires.
              </p>
              <TauxSection />
            </div>
          )}

          {tab === 'listes' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Ces listes alimentent les menus déroulants du formulaire de demande de paiement. Vous pouvez ajouter, modifier et supprimer chaque entrée.
              </p>
              {LISTES.map(l => (
                <ListeSection key={l.key} listKey={l.key} label={l.label} icon={l.icon} fields={l.fields} />
              ))}
            </div>
          )}

          {tab === 'formulaire' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Personnalisez intégralement le formulaire que voient les employés lors d'une demande de paiement.
                Masquez les champs inutiles, renommez les libellés, changez l'ordre ou ajoutez vos propres champs.
                <strong style={{ color: 'var(--abed-green)' }}> 4 champs essentiels ne peuvent pas être masqués</strong> (nom, montant, objet, urgence).
              </p>
              <FormulaireEditor />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
