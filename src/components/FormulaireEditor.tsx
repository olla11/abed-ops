'use client'
import { useState, useEffect } from 'react'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'file'
    | 'select_dept' | 'select_code' | 'select_projet' | 'select_nature'
    | 'select_mode' | 'select_urgence'
  required: boolean
  visible: boolean
  builtin: boolean
}

export const DEFAULT_FIELDS: FieldDef[] = [
  { key: 'nom_complet',     label: 'Nom et prénom complets',           type: 'text',           required: true,  visible: true, builtin: true },
  { key: 'email_contact',   label: 'Adresse email',                    type: 'email',          required: true,  visible: true, builtin: true },
  { key: 'departement',     label: 'Département / Équipe',             type: 'select_dept',    required: true,  visible: true, builtin: true },
  { key: 'objet',           label: 'Objet de la dépense',              type: 'textarea',       required: true,  visible: true, builtin: true },
  { key: 'code_budgetaire', label: 'Code budgétaire',                  type: 'select_code',    required: true,  visible: true, builtin: true },
  { key: 'projet',          label: 'Projet / Programme concerné',      type: 'select_projet',  required: true,  visible: true, builtin: true },
  { key: 'nature_depense',  label: 'Nature de la dépense',             type: 'select_nature',  required: true,  visible: true, builtin: true },
  { key: 'montant',         label: 'Montant demandé (FCFA)',           type: 'number',         required: true,  visible: true, builtin: true },
  { key: 'mode_paiement',   label: 'Mode de paiement',                 type: 'select_mode',    required: true,  visible: true, builtin: true },
  { key: 'beneficiaire',    label: 'Fournisseur / Bénéficiaire',       type: 'text',           required: true,  visible: true, builtin: true },
  { key: 'reference_piece', label: 'Référence pièce justificative',    type: 'text',           required: true,  visible: true, builtin: true },
  { key: 'justification',   label: 'Justification de la demande',      type: 'textarea',       required: true,  visible: true, builtin: true },
  { key: 'urgence',         label: "Niveau d'urgence",                 type: 'select_urgence', required: true,  visible: true, builtin: true },
  { key: 'date_souhaitee',  label: 'Date souhaitée de paiement',       type: 'date',           required: false, visible: true, builtin: true },
  { key: 'fichier',         label: 'Pièce justificative (fichier)',     type: 'file',           required: false, visible: true, builtin: true },
]

const TYPE_LABELS: Record<string, string> = {
  text: 'Texte court', email: 'Email', number: 'Nombre', date: 'Date',
  textarea: 'Texte long', file: 'Fichier',
  select_dept: 'Liste Départements', select_code: 'Liste Codes budgétaires',
  select_projet: 'Liste Projets', select_nature: 'Liste Natures',
  select_mode: 'Liste Modes paiement', select_urgence: 'Liste Urgence',
}

const IMMUTABLE_KEYS = ['nom_complet', 'montant', 'objet', 'urgence']

export default function FormulaireEditor() {
  const [fields, setFields] = useState<FieldDef[]>(DEFAULT_FIELDS)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [newField, setNewField] = useState({ label: '', type: 'text' as FieldDef['type'], required: false })
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    fetch('/api/config/form-config')
      .then(r => r.json())
      .then(j => { if (j.fields) setFields(j.fields) })
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/config/form-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    setSaving(false)
    setMsg(res.ok ? '✓ Formulaire mis à jour' : '✗ Erreur lors de la sauvegarde')
    setTimeout(() => setMsg(''), 3000)
  }

  function toggle(key: string, prop: 'visible' | 'required') {
    if (IMMUTABLE_KEYS.includes(key) && prop === 'visible') return
    setFields(fs => fs.map(f => f.key === key ? { ...f, [prop]: !f[prop] } : f))
  }

  function updateLabel(key: string, label: string) {
    setFields(fs => fs.map(f => f.key === key ? { ...f, label } : f))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...fields]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setFields(next)
  }

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function removeField(key: string, builtin: boolean) {
    if (builtin) {
      if (confirmDelete === key) {
        setFields(fs => fs.filter(f => f.key !== key))
        setConfirmDelete(null)
      } else {
        setConfirmDelete(key)
        setTimeout(() => setConfirmDelete(null), 4000)
      }
    } else {
      setFields(fs => fs.filter(f => f.key !== key))
    }
  }

  function addCustomField() {
    if (!newField.label.trim()) { setMsg('Saisissez un libellé'); return }
    const key = `custom_${Date.now()}`
    setFields(fs => [...fs, { key, label: newField.label.trim(), type: newField.type, required: newField.required, visible: true, builtin: false }])
    setNewField({ label: '', type: 'text', required: false })
    setAddOpen(false)
  }

  const visibleCount = fields.filter(f => f.visible).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: 0, color: 'var(--abed-green)' }}>Champs du formulaire ({visibleCount} visibles)</h4>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Masquer, renommer, réordonner ou ajouter des champs. Les champs en grisé sont obligatoires et ne peuvent pas être masqués.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? '#166534' : '#991b1b' }}>{msg}</span>}
          <button className="btn" onClick={save} disabled={saving} style={{ fontSize: 13 }}>
            {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
          </button>
        </div>
      </div>

      {/* Liste des champs */}
      <div style={{ border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* En-tête */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px 80px 80px 60px', gap: 8, padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid var(--abed-border)', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
          <span></span>
          <span>Libellé</span>
          <span>Type</span>
          <span>Requis</span>
          <span>Visible</span>
          <span>Ordre</span>
        </div>

        {fields.map((f, i) => {
          const isImmutable = IMMUTABLE_KEYS.includes(f.key)
          return (
            <div key={f.key} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 160px 80px 80px 60px',
              gap: 8, padding: '10px 12px', alignItems: 'center',
              borderBottom: '1px solid var(--abed-border)',
              background: !f.visible ? '#f9fafb' : 'white',
              opacity: !f.visible ? 0.6 : 1,
            }}>
              {/* Icône custom / builtin */}
              <span style={{ fontSize: 14, textAlign: 'center' }}>{f.builtin ? '🔒' : '✏️'}</span>

              {/* Label éditable */}
              <input
                value={f.label}
                onChange={e => updateLabel(f.key, e.target.value)}
                style={{
                  border: '1px solid transparent', borderRadius: 6, padding: '4px 8px',
                  fontSize: 13, background: 'transparent', width: '100%',
                  outline: 'none', cursor: 'text',
                }}
                onFocus={e => e.target.style.border = '1px solid var(--abed-green)'}
                onBlur={e => e.target.style.border = '1px solid transparent'}
              />

              {/* Type */}
              <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 999 }}>
                {TYPE_LABELS[f.type] ?? f.type}
              </span>

              {/* Requis toggle */}
              <button
                onClick={() => !isImmutable && toggle(f.key, 'required')}
                style={{
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600, cursor: isImmutable ? 'default' : 'pointer',
                  background: f.required ? '#dcfce7' : '#f3f4f6',
                  color: f.required ? '#166534' : '#6b7280',
                }}
              >
                {f.required ? 'Oui' : 'Non'}
              </button>

              {/* Visible toggle */}
              <button
                onClick={() => toggle(f.key, 'visible')}
                disabled={isImmutable}
                style={{
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600,
                  cursor: isImmutable ? 'default' : 'pointer',
                  background: f.visible ? '#dbeafe' : '#fee2e2',
                  color: f.visible ? '#1e40af' : '#991b1b',
                }}
              >
                {f.visible ? 'Affiché' : 'Masqué'}
              </button>

              {/* Ordre + Supprimer */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  style={{ background: 'none', border: '1px solid var(--abed-border)', borderRadius: 4, width: 24, height: 24, cursor: i === 0 ? 'default' : 'pointer', fontSize: 12, opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === fields.length - 1}
                  style={{ background: 'none', border: '1px solid var(--abed-border)', borderRadius: 4, width: 24, height: 24, cursor: i === fields.length - 1 ? 'default' : 'pointer', fontSize: 12, opacity: i === fields.length - 1 ? 0.3 : 1 }}>▼</button>
                {!IMMUTABLE_KEYS.includes(f.key) && (
                  <button
                    onClick={() => removeField(f.key, f.builtin)}
                    title={f.builtin && confirmDelete !== f.key ? 'Cliquer une 2e fois pour confirmer' : 'Supprimer'}
                    style={{
                      border: 'none', borderRadius: 4, width: 24, height: 24,
                      cursor: 'pointer', fontSize: 11, marginLeft: 2,
                      background: confirmDelete === f.key ? '#dc2626' : '#fee2e2',
                      color: confirmDelete === f.key ? 'white' : '#dc2626',
                      fontWeight: 700,
                    }}>
                    {confirmDelete === f.key ? '!' : '✕'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ajouter un champ personnalisé */}
      <div style={{ marginTop: 16 }}>
        {!addOpen ? (
          <button onClick={() => setAddOpen(true)}
            style={{ background: 'none', border: '1px dashed var(--abed-border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--abed-green)', cursor: 'pointer', width: '100%', fontWeight: 600 }}>
            + Ajouter un champ personnalisé
          </button>
        ) : (
          <div style={{ border: '1px solid var(--abed-green)', borderRadius: 10, padding: 16, background: '#f0fdf4' }}>
            <strong style={{ fontSize: 13, color: 'var(--abed-green)' }}>Nouveau champ</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, marginTop: 10, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Libellé *</label>
                <input className="input" placeholder="ex: Numéro de contrat" style={{ fontSize: 13 }}
                  value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                <select className="select" style={{ fontSize: 13 }} value={newField.type}
                  onChange={e => setNewField(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="text">Texte court</option>
                  <option value="textarea">Texte long</option>
                  <option value="number">Nombre</option>
                  <option value="date">Date</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Requis</label>
                <button onClick={() => setNewField(f => ({ ...f, required: !f.required }))}
                  style={{ border: '1px solid var(--abed-border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                    background: newField.required ? '#dcfce7' : 'white', color: newField.required ? '#166534' : '#6b7280' }}>
                  {newField.required ? 'Oui' : 'Non'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn" onClick={addCustomField} style={{ fontSize: 13 }}>Ajouter</button>
                <button className="btn secondary" onClick={() => setAddOpen(false)} style={{ fontSize: 13 }}>Annuler</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
