'use client'
import { useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, BarChart3, Folder, Tag, Check, Pencil, Trash2, Wallet, ClipboardList, FileText, PiggyBank } from 'lucide-react'
import FormulaireEditor from '@/components/FormulaireEditor'
import { HonorairesSection, PaliersSection, SalairesSection, AllocationsSection } from '@/components/BaremesSections'
import ComptesBancairesSection from '@/components/ComptesBancairesSection'

// ─── Types ───────────────────────────────────────────────────────────────────

type Item = { id: string; nom?: string; code?: string; libelle?: string }
type LigneBudget = { code: string; libelle: string; montant_annuel: number }

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const LISTES = [
  { key: 'departements',      label: 'Départements / Équipes',  icon: Building2, fields: ['nom'] as string[] },
  { key: 'codes_budgetaires', label: 'Codes budgétaires',        icon: BarChart3, fields: ['code', 'libelle'] as string[] },
  { key: 'projets',           label: 'Projets / Programmes',     icon: Folder, fields: ['nom'] as string[] },
  { key: 'natures',           label: 'Natures de dépense',       icon: Tag, fields: ['nom'] as string[] },
]

// ─── Sous-composant : une liste éditable ─────────────────────────────────────

function ListeSection({ listKey, label, icon: Icon, fields }: { listKey: string; label: string; icon: LucideIcon; fields: string[] }) {
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
        <Icon size={18} color="#374151" />
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#166534', color: 'white', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Check size={13} /> Valider
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  <Pencil size={12} /> Modifier
                </button>
                <button onClick={() => remove(item.id)} disabled={deleting === item.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                  {deleting === item.id ? '…' : <><Trash2 size={12} /> Supprimer</>}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sous-composant : budget adopté par ligne budgétaire ────────────────────

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

// ─── Composant principal ─────────────────────────────────────────────────────

type Tab = 'baremes' | 'listes' | 'formulaire' | 'budget'

const TABS: { key: Tab; label: string; icon: LucideIcon; desc: string }[] = [
  { key: 'baremes',    label: 'Barèmes & rémunération', icon: Wallet, desc: 'Honoraires, primes, salaires et allocations selon la politique de rémunération' },
  { key: 'listes',     label: 'Listes',           icon: ClipboardList, desc: 'Départements, codes budgétaires, projets, natures' },
  { key: 'budget',     label: 'Budget adopté',    icon: PiggyBank, desc: 'Montant annuel adopté par le CA pour chaque code budgétaire' },
  { key: 'formulaire', label: 'Formulaire',       icon: FileText, desc: 'Structure du formulaire de demande de paiement' },
]

export default function ParametresClient() {
  const [tab, setTab] = useState<Tab>('baremes')
  const active = TABS.find(t => t.key === tab)!

  return (
    <div className="page-container">

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: 'var(--abed-green)', margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Paramètres</h1>
        <p style={{ fontSize: 14, color: 'var(--abed-muted)', margin: 0 }}>
          Configuration financière et structure des formulaires de demande de paiement.
        </p>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
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
            <div style={{ marginBottom: 6 }}><t.icon size={22} /></div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
            <div style={{ fontSize: 12, opacity: tab === t.key ? 0.85 : 0.6, marginTop: 3 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Contenu de l'onglet ── */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--abed-border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        {/* Header du contenu */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--abed-border)', background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <active.icon size={24} color="#374151" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{active.label}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{active.desc}</div>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>

          {tab === 'baremes' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Politique de rémunération du personnel d'appui (adoptée par le CA le 31 juillet 2026) — réservée au CAF.
                Ces valeurs alimentent automatiquement le calcul du montant à payer lors de la validation des timesheets et la création des contrats.
              </p>
              <HonorairesSection />
              <PaliersSection />
              <SalairesSection />
              <AllocationsSection />
            </div>
          )}

          {tab === 'listes' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Ces listes alimentent les menus déroulants du formulaire de demande de paiement. Vous pouvez ajouter, modifier et supprimer chaque entrée.
              </p>
              <ComptesBancairesSection />
              {LISTES.map(l => (
                <ListeSection key={l.key} listKey={l.key} label={l.label} icon={l.icon} fields={l.fields} />
              ))}
            </div>
          )}

          {tab === 'budget' && (
            <div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                Sert à calculer la réalisation cumulée et la disponibilité sur les appels de fonds et l&apos;exécution financière.
              </p>
              <BudgetAdopteSection />
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
