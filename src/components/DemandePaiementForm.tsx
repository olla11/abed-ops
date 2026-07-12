'use client'
import { useState, useEffect } from 'react'
import { DEFAULT_FIELDS, type FieldDef } from '@/components/FormulaireEditor'

type Liste = { id: string; nom?: string; code?: string; libelle?: string }

const URGENCE_OPTS = [
  { value: 'urgente', label: '⚠️ Urgente (à traiter sous 72h)' },
  { value: 'normale', label: '🔶 Normale (délai normal)' },
  { value: 'peut_attendre', label: '🔵 Peut attendre (anticipée)' },
]

const MODE_PAIEMENT = [
  'Virement bancaire', 'Mobile Money (MTN)', 'Mobile Money (Moov)',
  'Espèces', 'Chèque',
]

export default function DemandePaiementForm({ onClose, prefill, soumissionId }: {
  onClose: () => void
  prefill?: Partial<Record<string, string>>
  soumissionId?: string
}) {
  const [fields, setFields] = useState<FieldDef[]>(DEFAULT_FIELDS)
  const [form, setForm] = useState<Record<string, string>>({ urgence: 'normale', ...prefill })
  const [fichier, setFichier] = useState<File | null>(null)
  const [depts, setDepts] = useState<Liste[]>([])
  const [codes, setCodes] = useState<Liste[]>([])
  const [projets, setProjets] = useState<Liste[]>([])
  const [natures, setNatures] = useState<Liste[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/config/form-config').then(r => r.json()),
      fetch('/api/config/listes?type=departements').then(r => r.json()),
      fetch('/api/config/listes?type=codes_budgetaires').then(r => r.json()),
      fetch('/api/config/listes?type=projets').then(r => r.json()),
      fetch('/api/config/listes?type=natures').then(r => r.json()),
    ]).then(([cfg, d, c, p, n]) => {
      if (cfg.fields) setFields(cfg.fields)
      setDepts(d.data ?? []); setCodes(c.data ?? [])
      setProjets(p.data ?? []); setNatures(n.data ?? [])
    })
  }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const visibleFields = fields.filter(f => f.visible)
  const requiredKeys = fields.filter(f => f.visible && f.required).map(f => f.key)

  async function submit() {
    for (const k of requiredKeys) {
      if (k === 'fichier') continue
      if (!form[k]?.trim()) {
        const field = fields.find(f => f.key === k)
        setMsg(`Champ requis : ${field?.label ?? k}`)
        return
      }
    }
    setLoading(true); setMsg('')
    try {
      let fichier_url = ''
      if (fichier) {
        const fd = new FormData(); fd.append('file', fichier)
        const up = await fetch('/api/demandes-paiement/upload', { method: 'POST', body: fd })
        const upj = await up.json()
        if (!up.ok) { setMsg('Erreur upload : ' + upj.error); setLoading(false); return }
        fichier_url = upj.path
      }
      const res = await fetch('/api/demandes-paiement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          montant: form.montant ? +form.montant : undefined,
          fichier_justificatif_url: fichier_url || undefined,
          soumission_id: soumissionId,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); setLoading(false); return }
      setDone(true)
    } catch (e: any) { setMsg('Erreur : ' + e.message) }
    finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h3 style={{ color: '#166534' }}>Demande soumise avec succès !</h3>
      <p style={{ color: 'var(--abed-muted)', marginBottom: 20 }}>
        Votre demande a été transmise à l'AAF. Vous recevrez un email à chaque étape.
      </p>
      <button className="btn" onClick={onClose}>Fermer</button>
    </div>
  )

  function renderField(f: FieldDef) {
    const label = `${f.label}${f.required ? ' *' : ''}`

    if (f.type === 'select_dept') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
          <option value="">— Sélectionner —</option>
          {depts.map(d => <option key={d.id} value={d.nom!}>{d.nom}</option>)}
        </select>
      </div>
    )
    if (f.type === 'select_code') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
          <option value="">— Sélectionner —</option>
          {codes.map(c => <option key={c.id} value={c.code!}>{c.code} — {c.libelle}</option>)}
        </select>
      </div>
    )
    if (f.type === 'select_projet') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
          <option value="">— Sélectionner —</option>
          {projets.map(p => <option key={p.id} value={p.nom!}>{p.nom}</option>)}
        </select>
      </div>
    )
    if (f.type === 'select_nature') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
          <option value="">— Sélectionner —</option>
          {natures.map(n => <option key={n.id} value={n.nom!}>{n.nom}</option>)}
        </select>
      </div>
    )
    if (f.type === 'select_mode') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
          <option value="">— Sélectionner —</option>
          {MODE_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    )
    if (f.type === 'select_urgence') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <select className="select" value={form[f.key] ?? 'normale'} onChange={e => set(f.key, e.target.value)}>
          {URGENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
    if (f.type === 'textarea') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <textarea className="input" rows={f.key === 'justification' ? 3 : 2}
          value={form[f.key] ?? ''}
          placeholder={f.key === 'objet' ? 'ex : Honoraire consultant formation…' : f.key === 'justification' ? 'Contexte, activité concernée, pourquoi ce paiement est nécessaire…' : ''}
          onChange={e => set(f.key, e.target.value)} />
        {f.key === 'justification' && (
          <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>
            Mettez la référence du TDR autorisé, de l&apos;Ordre de mission autorisé, ou la référence de la fiche d&apos;expression de besoin ou la référence du contrat, ou de la convention ou de l&apos;offre.
          </p>
        )}
      </div>
    )
    if (f.type === 'file') return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          onChange={e => setFichier(e.target.files?.[0] ?? null)} />
        <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>PDF, image, document. Max 10 Mo.</p>
      </div>
    )
    // text, email, number, date
    return (
      <div key={f.key} className="field">
        <label className="label">{label}</label>
        <input className="input" type={f.type} value={form[f.key] ?? ''}
          onChange={e => set(f.key, e.target.value)} />
      </div>
    )
  }

  // Regroupe nom_complet + email en 2 colonnes si les deux sont visibles
  const pairs: Array<FieldDef | [FieldDef, FieldDef]> = []
  const PAIR_GROUPS = [
    ['nom_complet', 'email_contact'],
    ['montant', 'mode_paiement'],
    ['beneficiaire', 'reference_piece'],
    ['urgence', 'date_souhaitee'],
  ]
  const consumed = new Set<string>()

  for (const f of visibleFields) {
    if (consumed.has(f.key)) continue
    const group = PAIR_GROUPS.find(g => g[0] === f.key)
    if (group) {
      const partner = visibleFields.find(f2 => f2.key === group[1])
      if (partner) {
        pairs.push([f, partner])
        consumed.add(f.key)
        consumed.add(partner.key)
        continue
      }
    }
    pairs.push(f)
    consumed.add(f.key)
  }

  return (
    <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '4px 2px' }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Demande de paiement</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Formulaire officiel. Toute demande incomplète sera automatiquement renvoyée.
      </p>

      {pairs.map((item, i) => {
        if (Array.isArray(item)) {
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {renderField(item[0])}
              {renderField(item[1])}
            </div>
          )
        }
        return renderField(item)
      })}

      {msg && (
        <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: '#fee2e2', color: '#991b1b' }}>{msg}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? '⏳ Envoi…' : 'Soumettre la demande'}
        </button>
        <button className="btn secondary" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
