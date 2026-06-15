'use client'
import { useEffect, useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string; status: string
  periode_mois: number; periode_annee: number
  heures_retenues: number; justification_heures: string | null
  montant_caf: number | null; paye: boolean
  fichier_facture_url: string | null; fichier_timesheet_url: string | null; fichier_livrable_url: string | null
  prestataire: { id: string; prenoms: string; nom: string; type_emploi: string | null } | null
}

type PrestataireCredit = {
  id: string; prenoms: string; nom: string; email: string
  total_valide: number; total_paye: number
}

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir : ' + (json.error ?? 'erreur'))
}

export default function ValidationCAF() {
  const supabase = createClient()

  const [items, setItems] = useState<Soumission[]>([])
  const [directs, setDirects] = useState<Soumission[]>([])
  const [credits, setCredits] = useState<PrestataireCredit[]>([])

  const [tauxDirect, setTauxDirect] = useState(1500)
  const [tauxCredit, setTauxCredit] = useState(1500)
  const [newTauxDirect, setNewTauxDirect] = useState('')
  const [newTauxCredit, setNewTauxCredit] = useState('')
  const [tauxMsg, setTauxMsg] = useState('')

  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pageItems, setPageItems] = useState(1)
  const [pageDirects, setPageDirects] = useState(1)
  const [pageCredits, setPageCredits] = useState(1)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  // Credit payment form
  const [creditForm, setCreditForm] = useState<Record<string, { montant: string; heures: string; note: string }>>({})
  const [payingCredit, setPayingCredit] = useState<string | null>(null)

  async function load() {
    const [{ data: tauxData }, { data: valides }] = await Promise.all([
      supabase.from('parametres').select('cle, valeur')
        .in('cle', ['taux_horaire_direct_fcfa', 'taux_horaire_credit_fcfa']),
      supabase
        .from('soumissions')
        .select('id,titre,status,periode_mois,periode_annee,heures_retenues,justification_heures,montant_caf,paye,fichier_facture_url,fichier_timesheet_url,fichier_livrable_url,prestataire:profiles!soumissions_prestataire_id_fkey(id,prenoms,nom,type_emploi)')
        .in('status', ['valide_tech', 'valide_caf'])
        .order('created_at', { ascending: false }),
    ])

    const tauxMap = Object.fromEntries((tauxData ?? []).map((r: any) => [r.cle, Number(r.valeur)]))
    const td = tauxMap['taux_horaire_direct_fcfa'] ?? 1500
    const tc = tauxMap['taux_horaire_credit_fcfa'] ?? 1500
    setTauxDirect(td); setNewTauxDirect(String(td))
    setTauxCredit(tc); setNewTauxCredit(String(tc))

    const all = (valides as any[]) ?? []

    // À valider techniquement → CAF
    setItems(all.filter(s => s.status === 'valide_tech'))

    // Préstataires directs : validés CAF et non payés
    setDirects(all.filter(s => s.status === 'valide_caf' && !s.paye
      && (s.prestataire?.type_emploi === 'prestataire_direct' || s.prestataire?.type_emploi === 'cdd')))

    // Préstataires à crédit : agréger le solde
    const creditItems = all.filter(s => s.status === 'valide_caf'
      && s.prestataire?.type_emploi === 'prestataire_credit')

    // Charger les paiements déjà effectués
    const creditIds = [...new Set(creditItems.map(s => s.prestataire?.id).filter(Boolean))]
    let paiementsMap: Record<string, number> = {}
    if (creditIds.length > 0) {
      const { data: paiements } = await supabase
        .from('paiements_prestataires')
        .select('prestataire_id, montant')
        .in('prestataire_id', creditIds)
      for (const p of paiements ?? []) {
        paiementsMap[p.prestataire_id] = (paiementsMap[p.prestataire_id] ?? 0) + Number(p.montant)
      }
    }

    const grouped: Record<string, PrestataireCredit> = {}
    for (const s of creditItems) {
      const pid = s.prestataire?.id ?? ''
      if (!grouped[pid]) {
        grouped[pid] = { id: pid, prenoms: s.prestataire?.prenoms ?? '', nom: s.prestataire?.nom ?? '',
          email: '', total_valide: 0, total_paye: paiementsMap[pid] ?? 0 }
      }
      grouped[pid].total_valide += s.montant_caf ?? 0
    }
    setCredits(Object.values(grouped))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveTaux() {
    const res = await fetch('/api/config/taux', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_direct: newTauxDirect, taux_credit: newTauxCredit }),
    })
    const json = await res.json()
    if (res.ok) {
      setTauxDirect(+newTauxDirect); setTauxCredit(+newTauxCredit)
      setTauxMsg('✓ Taux mis à jour')
    } else {
      setTauxMsg('Erreur : ' + json.error)
    }
    setTimeout(() => setTauxMsg(''), 3000)
  }

  async function decider(id: string, action: 'valider' | 'corriger' | 'rejeter') {
    if (action !== 'valider' && !commentMap[id]?.trim()) {
      alert('Un commentaire est obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/timesheets/${id}/valider-caf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire_caf: commentMap[id] }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  async function payerDirect(soumId: string) {
    if (!confirm('Confirmer le paiement de ce dossier ?')) return
    setSubmitting(soumId)
    const res = await fetch(`/api/timesheets/${soumId}/payer`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    else alert('✓ Paiement enregistré. Email envoyé au prestataire.')
    setSubmitting(null); load()
  }

  async function payerCredit(prestId: string) {
    const form = creditForm[prestId] ?? {}
    if (!form.montant || +form.montant <= 0) { alert('Saisissez un montant.'); return }
    setPayingCredit(prestId)
    const res = await fetch('/api/timesheets/payer-credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prestataire_id: prestId,
        montant: form.montant,
        heures_payees: form.heures || undefined,
        note: form.note || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    else {
      alert('✓ Versement enregistré. Email envoyé au prestataire.')
      setCreditForm(f => { const c = { ...f }; delete c[prestId]; return c })
    }
    setPayingCredit(null); load()
  }

  if (loading) return <p>Chargement…</p>

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Taux horaires ── */}
      <div className="card" style={{ borderLeft: '4px solid var(--abed-green)' }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>⚙️ Taux horaires</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Prestataire direct (FCFA/h)
            </label>
            <input className="input" type="number" min={100} step={50}
              value={newTauxDirect} onChange={e => setNewTauxDirect(e.target.value)} />
            <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 2 }}>
              Actuel : <strong>{tauxDirect.toLocaleString('fr-FR')} FCFA/h</strong>
            </p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Prestataire à crédit (FCFA/h)
            </label>
            <input className="input" type="number" min={100} step={50}
              value={newTauxCredit} onChange={e => setNewTauxCredit(e.target.value)} />
            <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 2 }}>
              Actuel : <strong>{tauxCredit.toLocaleString('fr-FR')} FCFA/h</strong>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" style={{ fontSize: 13 }} onClick={saveTaux}>Enregistrer les taux</button>
          {tauxMsg && <span style={{ fontSize: 13, color: tauxMsg.startsWith('✓') ? '#166534' : '#991b1b' }}>{tauxMsg}</span>}
        </div>
      </div>

      {/* ── Validation CAF ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Validation CAF — Contrôle des factures ({items.length})</h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
          Dossiers validés techniquement. Vérifiez la facture et validez le montant.
        </p>
        {items.length === 0 && <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun dossier en attente.</p>}
        {paginate(items, pageItems).map(s => {
          const isOpen = expanded === s.id
          const taux = s.prestataire?.type_emploi === 'prestataire_credit' ? tauxCredit : tauxDirect
          const montant = Math.round((s.heures_retenues ?? 0) * taux)
          const typeLabel = s.prestataire?.type_emploi === 'prestataire_credit' ? 'Crédit' : 'Direct'
          return (
            <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div>
                  <strong>{s.titre}</strong>
                  <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                    {s.prestataire?.prenoms} {s.prestataire?.nom}
                    {' '}
                    <span style={{ background: s.prestataire?.type_emploi === 'prestataire_credit' ? '#dbeafe' : '#dcfce7',
                      color: s.prestataire?.type_emploi === 'prestataire_credit' ? '#1e40af' : '#166534',
                      padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                      {typeLabel}
                    </span>
                    {' '}— {s.periode_mois}/{s.periode_annee}
                    {' '}— <strong>{s.heures_retenues} h</strong>
                    {' '}→ <strong style={{ color: 'var(--abed-green)' }}>{montant.toLocaleString('fr-FR')} FCFA</strong>
                  </span>
                </div>
                <span style={{ fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      Montant : {montant.toLocaleString('fr-FR')} FCFA ({s.heures_retenues} h × {taux.toLocaleString('fr-FR')} F)
                    </p>
                    {s.justification_heures && (
                      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 4, fontStyle: 'italic' }}>
                        Justification manager : {s.justification_heures}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {s.fichier_facture_url && <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_facture_url!)}>🧾 Facture</button>}
                    {s.fichier_timesheet_url && <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_timesheet_url!)}>📊 Timesheet</button>}
                    {s.fichier_livrable_url && <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_livrable_url!)}>📄 Livrable</button>}
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Commentaire (obligatoire si rejet ou correction)</label>
                    <textarea className="input" rows={2} value={commentMap[s.id] ?? ''}
                      placeholder="Motif…"
                      onChange={e => setCommentMap(m => ({ ...m, [s.id]: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'valider')}>
                      ✓ Valider — {montant.toLocaleString('fr-FR')} FCFA
                    </button>
                    <button className="btn danger" style={{ fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'corriger')}>
                      Correction facture
                    </button>
                    <button className="btn danger" style={{ fontSize: 13, background: '#7f1d1d' }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'rejeter')}>
                      Rejeter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <Pagination page={pageItems} total={items.length} onChange={setPageItems} />
      </div>

      {/* ── Paiements Directs ── */}
      {directs.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>💳 Paiements — Prestataires directs ({directs.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
            Dossiers validés CAF en attente de paiement (mensuel).
          </p>
          {paginate(directs, pageDirects).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--abed-border)', padding: '12px 0', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{s.prestataire?.prenoms} {s.prestataire?.nom}</strong>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 8 }}>
                  {s.titre} — {s.periode_mois}/{s.periode_annee} —{' '}
                  <strong style={{ color: 'var(--abed-green)' }}>
                    {(s.montant_caf ?? 0).toLocaleString('fr-FR')} FCFA
                  </strong>
                </span>
              </div>
              <button className="btn" style={{ fontSize: 13, background: '#15803d' }}
                disabled={submitting === s.id}
                onClick={() => payerDirect(s.id)}>
                {submitting === s.id ? '⏳…' : '💳 Payer'}
              </button>
            </div>
          ))}
          <Pagination page={pageDirects} total={directs.length} onChange={setPageDirects} />
        </div>
      )}

      {/* ── Paiements Crédit ── */}
      {credits.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>📊 Soldes — Prestataires à crédit ({credits.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
            Solde cumulatif par prestataire. Effectuez un versement partiel ou total.
          </p>
          {paginate(credits, pageCredits).map(p => {
            const reste = p.total_valide - p.total_paye
            const form = creditForm[p.id] ?? { montant: '', heures: '', note: '' }
            return (
              <div key={p.id} style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{p.prenoms} {p.nom}</strong>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 13 }}>
                      <span>Total validé : <strong>{p.total_valide.toLocaleString('fr-FR')} F</strong></span>
                      <span>Déjà payé : <strong style={{ color: '#166534' }}>{p.total_paye.toLocaleString('fr-FR')} F</strong></span>
                      <span>Reste dû : <strong style={{ color: reste > 0 ? '#991b1b' : '#166534' }}>
                        {reste.toLocaleString('fr-FR')} F</strong>
                      </span>
                    </div>
                  </div>
                </div>
                {reste > 0 && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Montant (FCFA) *</label>
                      <input className="input" type="number" min={1} step={500} placeholder={String(reste)}
                        value={form.montant}
                        onChange={e => setCreditForm(f => ({ ...f, [p.id]: { ...form, montant: e.target.value } }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Heures (optionnel)</label>
                      <input className="input" type="number" min={0} step={0.5}
                        value={form.heures}
                        onChange={e => setCreditForm(f => ({ ...f, [p.id]: { ...form, heures: e.target.value } }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note (optionnel)</label>
                      <input className="input" type="text" placeholder="Mois concerné, motif…"
                        value={form.note}
                        onChange={e => setCreditForm(f => ({ ...f, [p.id]: { ...form, note: e.target.value } }))} />
                    </div>
                    <button className="btn" style={{ fontSize: 13, background: '#15803d', whiteSpace: 'nowrap' }}
                      disabled={payingCredit === p.id}
                      onClick={() => payerCredit(p.id)}>
                      {payingCredit === p.id ? '⏳…' : '💳 Verser'}
                    </button>
                  </div>
                )}
                {reste <= 0 && (
                  <p style={{ fontSize: 13, color: '#166534', marginTop: 8 }}>✓ Solde soldé</p>
                )}
              </div>
            )
          })}
          <Pagination page={pageCredits} total={credits.length} onChange={setPageCredits} />
        </div>
      )}
    </div>
  )
}
