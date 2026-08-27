'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, Power } from 'lucide-react'

type Article = { titre: string; contenu: string }
type Champ = { cle: string; libelle: string; type: 'text' | 'textarea' | 'date' | 'number'; requis?: boolean; defaut?: string; aide?: string }
type Template = {
  id: string; nom: string; type_contrat: string; categorie_document: string
  objet_template: string | null; articles: Article[]; champs: Champ[]; actif: boolean
}

const TYPES = ['CDD', 'CDI', 'Stage N1', 'Stage N2', 'Bénévolat', 'Prestataire direct', 'Prestataire à crédit', 'Consultant']
const CATEGORIES = ['Contrat', 'Convention', 'Avenant', 'Offre de stage']
const TYPES_CHAMP: Champ['type'][] = ['text', 'textarea', 'date', 'number']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

function vide(): Template {
  return { id: '', nom: '', type_contrat: '', categorie_document: 'Contrat', objet_template: '', articles: [], champs: [], actif: true }
}

export default function TemplatesClient({ templates: initial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initial)
  const [editing, setEditing] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (editing) document.body.classList.add('panel-open')
    else document.body.classList.remove('panel-open')
    return () => document.body.classList.remove('panel-open')
  }, [editing])

  function openNew() { setEditing(vide()); setErr(null) }
  function openEdit(t: Template) { setEditing({ ...t, articles: [...t.articles], champs: [...t.champs] }); setErr(null) }

  async function save() {
    if (!editing) return
    if (!editing.nom.trim() || !editing.type_contrat || !editing.categorie_document) {
      setErr('Nom, type et catégorie sont obligatoires.'); return
    }
    setLoading(true); setErr(null)
    try {
      const isNew = !editing.id
      const res = await fetch(isNew ? '/api/rh/contrat-templates' : `/api/rh/contrat-templates/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      setTemplates(ts => isNew ? [d.template, ...ts] : ts.map(t => t.id === d.template.id ? d.template : t))
      setEditing(null)
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function toggleActif(t: Template) {
    const res = await fetch(`/api/rh/contrat-templates/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...t, actif: !t.actif }),
    })
    if (res.ok) { const d = await res.json(); setTemplates(ts => ts.map(x => x.id === t.id ? d.template : x)) }
  }

  async function supprimer(t: Template) {
    if (!confirm(`Supprimer le modèle « ${t.nom} » ? Les contrats déjà créés à partir de ce modèle ne sont pas affectés.`)) return
    const res = await fetch(`/api/rh/contrat-templates/${t.id}`, { method: 'DELETE' })
    if (res.ok) setTemplates(ts => ts.filter(x => x.id !== t.id))
    else { const d = await res.json(); alert(d.error ?? 'Erreur') }
  }

  function updateArticle(i: number, field: 'titre' | 'contenu', val: string) {
    if (!editing) return
    setEditing({ ...editing, articles: editing.articles.map((a, idx) => idx === i ? { ...a, [field]: val } : a) })
  }
  function addArticle() { if (editing) setEditing({ ...editing, articles: [...editing.articles, { titre: '', contenu: '' }] }) }
  function removeArticle(i: number) { if (editing) setEditing({ ...editing, articles: editing.articles.filter((_, idx) => idx !== i) }) }

  function updateChamp(i: number, field: keyof Champ, val: string | boolean) {
    if (!editing) return
    setEditing({ ...editing, champs: editing.champs.map((c, idx) => idx === i ? { ...c, [field]: val } : c) })
  }
  function addChamp() { if (editing) setEditing({ ...editing, champs: [...editing.champs, { cle: '', libelle: '', type: 'text', requis: true }] }) }
  function removeChamp(i: number) { if (editing) setEditing({ ...editing, champs: editing.champs.filter((_, idx) => idx !== i) }) }

  return (
    <div className="page-container">
      <Link href="/rh/contrats" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#6b7280', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> Retour aux documents RH
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Modèles de contrat</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Un modèle par type × catégorie de document — le texte légal standard est figé, seuls les champs déclarés varient d'une personne à l'autre.
          </p>
        </div>
        <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', whiteSpace: 'nowrap' }}>
          + Nouveau modèle
        </button>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ minWidth: 700, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Nom', 'Type', 'Catégorie', 'Articles', 'Champs', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{t.nom}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{t.type_contrat}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{t.categorie_document}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{t.articles.length}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{t.champs.length}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => toggleActif(t)} title={t.actif ? 'Désactiver' : 'Activer'} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: 'none',
                      background: t.actif ? '#dcfce7' : '#f3f4f6', color: t.actif ? '#166534' : '#6b7280',
                    }}>
                      <Power size={10} /> {t.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(t)} title="Modifier" style={{ padding: 6, borderRadius: 6, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', marginRight: 6 }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => supprimer(t)} title="Supprimer" style={{ padding: 6, borderRadius: 6, cursor: 'pointer', background: 'white', border: '1px solid #fecaca', color: '#dc2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun modèle. Créez-en un pour accélérer la saisie des contrats.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 20, fontSize: 16 }}>{editing.id ? `Modifier — ${editing.nom}` : 'Nouveau modèle'}</h3>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nom du modèle *</label>
                <input value={editing.nom} onChange={e => setEditing({ ...editing, nom: e.target.value })} placeholder="Ex. Convention de Bénévolat" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Actif</label>
                <select value={editing.actif ? '1' : '0'} onChange={e => setEditing({ ...editing, actif: e.target.value === '1' })} style={inputStyle}>
                  <option value="1">Oui — proposé à la création</option>
                  <option value="0">Non — désactivé</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type de contrat *</label>
                <select value={editing.type_contrat} onChange={e => setEditing({ ...editing, type_contrat: e.target.value })} style={inputStyle}>
                  <option value="">— Choisir —</option>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Catégorie *</label>
                <select value={editing.categorie_document} onChange={e => setEditing({ ...editing, categorie_document: e.target.value })} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Préambule / Objet <span style={{ fontWeight: 400, color: '#9ca3af' }}>(utilisez {'{{cle}}'} pour les parties variables)</span>
              </label>
              <textarea value={editing.objet_template ?? ''} onChange={e => setEditing({ ...editing, objet_template: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12.5 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Articles ({editing.articles.length})</label>
                <button type="button" onClick={addArticle} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontWeight: 700 }}>+ Article</button>
              </div>
              {editing.articles.map((art, i) => (
                <div key={i} style={{ border: '1px solid var(--abed-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--abed-green)' }}>Article {i + 1}</span>
                    <button type="button" onClick={() => removeArticle(i)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626' }}>✕</button>
                  </div>
                  <input placeholder="Titre de l'article..." value={art.titre} onChange={e => updateArticle(i, 'titre', e.target.value)} style={{ ...inputStyle, marginBottom: 6, fontSize: 13 }} />
                  <textarea placeholder="Contenu... (utilisez {{cle}} pour les parties variables)" value={art.contenu} onChange={e => updateArticle(i, 'contenu', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', fontSize: 12.5, fontFamily: 'monospace' }} />
                </div>
              ))}
              {editing.articles.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun article.</p>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Champs variables ({editing.champs.length})</label>
                <button type="button" onClick={addChamp} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontWeight: 700 }}>+ Champ</button>
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                Chaque clé doit correspondre à un {'{{cle}}'} utilisé ci-dessus. Les clés <code>poste</code>, <code>date_debut_texte</code>, <code>date_fin_texte</code> et, pour un avenant, <code>date_convention_initiale_texte</code>, sont déjà fournies automatiquement — inutile de les déclarer.
              </p>
              {editing.champs.map((c, i) => (
                <div key={i} style={{ border: '1px solid var(--abed-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <button type="button" onClick={() => removeChamp(i)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626' }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                    <input placeholder="clé (ex. duree_mois)" value={c.cle} onChange={e => updateChamp(i, 'cle', e.target.value.replace(/[^a-z0-9_]/gi, '_'))} style={{ ...inputStyle, fontSize: 12.5, fontFamily: 'monospace' }} />
                    <input placeholder="Libellé affiché à la RH" value={c.libelle} onChange={e => updateChamp(i, 'libelle', e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <select value={c.type} onChange={e => updateChamp(i, 'type', e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }}>
                      {TYPES_CHAMP.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input placeholder="Valeur par défaut" value={c.defaut ?? ''} onChange={e => updateChamp(i, 'defaut', e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }} />
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={c.requis ?? false} onChange={e => updateChamp(i, 'requis', e.target.checked)} /> Obligatoire
                    </label>
                  </div>
                  <input placeholder="Aide (optionnel)" value={c.aide ?? ''} onChange={e => updateChamp(i, 'aide', e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }} />
                </div>
              ))}
              {editing.champs.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun champ déclaré.</p>}
            </div>

            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditing(null); setErr(null) }} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={save} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
                {loading ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
