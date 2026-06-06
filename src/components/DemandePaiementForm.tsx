'use client'
import { useState, useEffect } from 'react'

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

export default function DemandePaiementForm({ onClose, prefill }: {
  onClose: () => void
  prefill?: Partial<Record<string, string>>
}) {
  const [form, setForm] = useState({
    nom_complet: '', email_contact: '', departement: '',
    objet: '', code_budgetaire: '', projet: '', nature_depense: '',
    montant: '', mode_paiement: '', beneficiaire: '', reference_piece: '',
    justification: '', urgence: 'normale', date_souhaitee: '',
    ...prefill,
  })
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
      fetch('/api/config/listes?type=departements').then(r => r.json()),
      fetch('/api/config/listes?type=codes_budgetaires').then(r => r.json()),
      fetch('/api/config/listes?type=projets').then(r => r.json()),
      fetch('/api/config/listes?type=natures').then(r => r.json()),
    ]).then(([d, c, p, n]) => {
      setDepts(d.data ?? []); setCodes(c.data ?? [])
      setProjets(p.data ?? []); setNatures(n.data ?? [])
    })
  }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    const required = ['nom_complet','email_contact','departement','objet','code_budgetaire',
      'projet','nature_depense','montant','mode_paiement','beneficiaire','reference_piece','justification','urgence']
    for (const f of required) {
      if (!form[f as keyof typeof form]) { setMsg(`Champ requis : ${f}`); return }
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
        body: JSON.stringify({ ...form, montant: +form.montant, fichier_justificatif_url: fichier_url || undefined }),
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

  const inp = (k: string, label: string, type = 'text', extra?: any) => (
    <div className="field">
      <label className="label">{label} *</label>
      <input className="input" type={type} value={form[k as keyof typeof form] as string}
        onChange={e => set(k, e.target.value)} {...extra} />
    </div>
  )

  const sel = (k: string, label: string, opts: {value:string;label:string}[]) => (
    <div className="field">
      <label className="label">{label} *</label>
      <select className="select" value={form[k as keyof typeof form] as string}
        onChange={e => set(k, e.target.value)}>
        <option value="">— Sélectionner —</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '4px 2px' }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Demande de paiement</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Formulaire officiel. Toute demande incomplète sera automatiquement renvoyée.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {inp('nom_complet', 'Nom et prénom complets')}
        {inp('email_contact', 'Adresse email', 'email')}
      </div>

      {sel('departement', 'Département / Équipe',
        depts.map(d => ({ value: d.nom!, label: d.nom! })))}

      <div className="field">
        <label className="label">Objet de la dépense *</label>
        <textarea className="input" rows={2} value={form.objet}
          placeholder="ex : Honoraire consultant formation D'croch — Bootcamp Collines Mai 2026"
          onChange={e => set('objet', e.target.value)} />
      </div>

      {sel('code_budgetaire', 'Code budgétaire',
        codes.map(c => ({ value: c.code!, label: `${c.code} — ${c.libelle}` })))}

      {sel('projet', 'Projet / Programme concerné',
        projets.map(p => ({ value: p.nom!, label: p.nom! })))}

      {sel('nature_depense', 'Nature de la dépense',
        natures.map(n => ({ value: n.nom!, label: n.nom! })))}

      <hr style={{ margin: '12px 0', borderColor: 'var(--abed-border)' }} />
      <strong style={{ fontSize: 13 }}>Détails financiers</strong>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {inp('montant', 'Montant demandé (FCFA)', 'number')}
        {sel('mode_paiement', 'Mode de paiement',
          MODE_PAIEMENT.map(m => ({ value: m, label: m })))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {inp('beneficiaire', 'Fournisseur / Bénéficiaire')}
        {inp('reference_piece', 'Référence pièce justificative')}
      </div>

      <hr style={{ margin: '12px 0', borderColor: 'var(--abed-border)' }} />
      <strong style={{ fontSize: 13 }}>Justification et urgence</strong>

      <div className="field" style={{ marginTop: 8 }}>
        <label className="label">Justification de la demande *</label>
        <textarea className="input" rows={3} value={form.justification}
          placeholder="Contexte, activité concernée, pourquoi ce paiement est nécessaire…"
          onChange={e => set('justification', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {sel('urgence', 'Niveau d\'urgence', URGENCE_OPTS)}
        {inp('date_souhaitee', 'Date souhaitée de paiement', 'date')}
      </div>

      <div className="field">
        <label className="label">Pièce justificative (facture, devis, bon de commande…)</label>
        <input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          onChange={e => setFichier(e.target.files?.[0] ?? null)} />
        <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>
          PDF, image, document. Max 10 Mo.
        </p>
      </div>

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
