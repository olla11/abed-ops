'use client'
import { useEffect, useState } from 'react'

type CompteBancaire = { id: string; nom: string }
type CodeBudgetaire = { code: string; libelle: string }
type PayRollItem = {
  id: string
  source_type: string
  reference: string | null
  beneficiaire_nom: string
  objet: string
  code_budgetaire: string | null
  montant: number
  statut: 'non_paye' | 'a_payer' | 'paye'
  compte_bancaire_id: string | null
  compte_bancaire: CompteBancaire | null
  appel_de_fonds_id: string | null
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  demande_paiement: 'Demande',
  rapport_allocation: 'Allocation',
  reconciliation_mission: 'Réconciliation',
  timesheet: 'Timesheet',
}

const STATUT_LABELS: Record<string, string> = { non_paye: 'Non payé', a_payer: 'À payer', paye: 'Payé' }
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  non_paye: { bg: '#fef2f2', color: '#991b1b' },
  a_payer: { bg: '#fffbeb', color: '#92400e' },
  paye: { bg: '#f0fdf4', color: '#16a34a' },
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 6, fontSize: 12.5,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const FILTRES: { key: 'tous' | 'non_paye' | 'a_payer' | 'paye'; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'non_paye', label: 'Non payé' },
  { key: 'a_payer', label: 'À payer' },
  { key: 'paye', label: 'Payé' },
]

export default function PayRollClient() {
  const [items, setItems] = useState<PayRollItem[]>([])
  const [comptes, setComptes] = useState<CompteBancaire[]>([])
  const [codes, setCodes] = useState<CodeBudgetaire[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'non_paye' | 'a_payer' | 'paye'>('tous')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [showGenerer, setShowGenerer] = useState(false)
  const [commentaireCaf, setCommentaireCaf] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')
  const [brouillon, setBrouillon] = useState<{ id: string; numero: string; url: string | null } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [annulation, setAnnulation] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/pay-roll').then(r => r.json()).then(j => setItems(j.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/config/listes?type=comptes_bancaires').then(r => r.json()).then(j => setComptes(j.data ?? []))
    fetch('/api/config/listes?type=codes_budgetaires&actifs=1').then(r => r.json()).then(j => setCodes(j.data ?? []))
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id); setErr('')
    const res = await fetch(`/api/pay-roll/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await res.json()
    setSavingId(null)
    if (!res.ok) { setErr(j.error ?? 'Erreur'); return }
    load()
  }

  const visibles = filtre === 'tous' ? items : items.filter(i => i.statut === filtre)

  function toggleSelection(id: string) {
    setSelection(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectionnables = visibles.filter(i => i.statut === 'a_payer' && !i.appel_de_fonds_id)
  const itemsSelectionnes = items.filter(i => selection.has(i.id))
  const montantSelection = itemsSelectionnes.reduce((s, i) => s + Number(i.montant), 0)

  async function genererAppelDeFonds() {
    setGenerating(true); setGenMsg('')
    const res = await fetch('/api/pay-roll/appels-de-fonds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payRollIds: [...selection], commentaireCaf }),
    })
    const j = await res.json()
    setGenerating(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    const docRes = await fetch(`/api/pay-roll/appels-de-fonds/${j.appelDeFondsId}/document`)
    const docJ = await docRes.json()
    setBrouillon({ id: j.appelDeFondsId, numero: j.numero, url: docJ.url ?? null })
    load()
  }

  async function envoyerDansLeCircuit() {
    if (!brouillon) return
    setEnvoi(true); setGenMsg('')
    const res = await fetch(`/api/pay-roll/appels-de-fonds/${brouillon.id}/envoyer`, { method: 'POST' })
    const j = await res.json()
    setEnvoi(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    fermerModalGenerer()
    load()
  }

  async function annulerBrouillon() {
    if (!brouillon) return
    setAnnulation(true); setGenMsg('')
    const res = await fetch(`/api/pay-roll/appels-de-fonds/${brouillon.id}`, { method: 'DELETE' })
    const j = await res.json()
    setAnnulation(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    setBrouillon(null)
    load()
  }

  function fermerModalGenerer() {
    setShowGenerer(false); setSelection(new Set()); setCommentaireCaf(''); setGenMsg(''); setBrouillon(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTRES.map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key)} style={{
            padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: '1.5px solid', borderColor: filtre === f.key ? 'var(--abed-green)' : 'var(--abed-border)',
            background: filtre === f.key ? '#f0fdf4' : 'white',
            color: filtre === f.key ? 'var(--abed-green)' : '#374151',
          }}>
            {f.label} {f.key !== 'tous' && `(${items.filter(i => i.statut === f.key).length})`}
          </button>
        ))}
      </div>

      {err && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {selection.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 16px',
          background: '#f0fdf4', border: '1.5px solid var(--abed-green)', borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
            {selection.size} paiement{selection.size > 1 ? 's' : ''} sélectionné{selection.size > 1 ? 's' : ''} — {montantSelection.toLocaleString('fr-FR')} FCFA
          </span>
          <button className="btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowGenerer(true)}>
            Générer un appel de fonds
          </button>
          <button className="btn secondary" style={{ fontSize: 13 }} onClick={() => setSelection(new Set())}>
            Annuler
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : visibles.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Aucun paiement ici pour le moment.
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 1300, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Référence</th>
                <th>Source</th>
                <th>Bénéficiaire</th>
                <th>Objet</th>
                <th>Code budgétaire</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Compte</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(item => {
                const dejaPaye = item.statut === 'paye'
                const selectionnable = item.statut === 'a_payer' && !item.appel_de_fonds_id
                const codeChoisi = codes.find(c => c.code === item.code_budgetaire)
                return (
                  <tr key={item.id} style={{ opacity: savingId === item.id ? 0.6 : 1 }}>
                    <td>
                      {selectionnable && (
                        <input type="checkbox" checked={selection.has(item.id)} onChange={() => toggleSelection(item.id)} />
                      )}
                      {item.appel_de_fonds_id && (
                        <span title="Déjà inclus dans un appel de fonds" style={{ fontSize: 11, color: 'var(--abed-muted)' }}>📎</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--abed-muted)', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', wordBreak: 'break-word' }}>{item.reference ?? '—'}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--abed-muted)' }}>{SOURCE_LABELS[item.source_type] ?? item.source_type}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.3 }}>{item.beneficiaire_nom}</td>
                    <td style={{ fontSize: 13, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.35 }}>{item.objet}</td>
                    <td style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                      {dejaPaye ? (
                        <span style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                          {item.code_budgetaire ? <><strong>{item.code_budgetaire}</strong>{codeChoisi ? ` — ${codeChoisi.libelle}` : ''}</> : '—'}
                        </span>
                      ) : (
                        <select
                          style={{ ...inputStyle, width: '100%' }}
                          value={item.code_budgetaire ?? ''}
                          disabled={savingId === item.id}
                          onChange={e => patch(item.id, { code_budgetaire: e.target.value })}
                        >
                          <option value="">— Choisir —</option>
                          {codes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(item.montant).toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <select
                        style={{
                          ...inputStyle, fontWeight: 700, width: '100%',
                          background: STATUT_COLORS[item.statut]?.bg, color: STATUT_COLORS[item.statut]?.color,
                          border: 'none',
                        }}
                        value={item.statut}
                        disabled={dejaPaye || savingId === item.id}
                        onChange={e => patch(item.id, { statut: e.target.value })}
                      >
                        <option value="non_paye">{STATUT_LABELS.non_paye}</option>
                        <option value="a_payer">{STATUT_LABELS.a_payer}</option>
                        {dejaPaye && <option value="paye">{STATUT_LABELS.paye}</option>}
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                      {dejaPaye ? (
                        <span style={{ fontSize: 12.5 }}>{item.compte_bancaire?.nom ?? '—'}</span>
                      ) : (
                        <select
                          style={{ ...inputStyle, width: '100%' }}
                          value={item.compte_bancaire_id ?? ''}
                          disabled={savingId === item.id}
                          onChange={e => patch(item.id, { compte_bancaire_id: e.target.value })}
                        >
                          <option value="">— Choisir —</option>
                          {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showGenerer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(17,24,39,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          {!brouillon ? (
            <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 480, padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
              <h3 style={{ margin: '0 0 6px', color: 'var(--abed-green)' }}>Générer l&apos;appel de fonds</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 16px' }}>
                {selection.size} paiement{selection.size > 1 ? 's' : ''} — {montantSelection.toLocaleString('fr-FR')} FCFA.
                Le PDF sera généré pour vérification avant d&apos;être envoyé dans le circuit de signature (DE → TG CA → PCA).
              </p>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Commentaire (optionnel)</label>
              <textarea
                value={commentaireCaf} onChange={e => setCommentaireCaf(e.target.value)} rows={3}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 16 }}
              />
              {genMsg && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{genMsg}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={fermerModalGenerer} disabled={generating}>Annuler</button>
                <button className="btn" onClick={genererAppelDeFonds} disabled={generating}>
                  {generating ? 'Génération…' : 'Générer le PDF'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 760, padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <h3 style={{ margin: '0 0 6px', color: 'var(--abed-green)' }}>Appel de fonds N° {brouillon.numero} — brouillon</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
                Vérifiez le document avant de l&apos;envoyer dans le circuit de signature (DE → TG CA → PCA). Vous pouvez encore l&apos;annuler.
              </p>
              {brouillon.url ? (
                <iframe src={brouillon.url} style={{ flex: 1, width: '100%', minHeight: 420, border: '1px solid var(--abed-border)', borderRadius: 8, marginBottom: 16 }} />
              ) : (
                <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 16 }}>PDF indisponible pour l&apos;aperçu.</p>
              )}
              {genMsg && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{genMsg}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={annulerBrouillon} disabled={envoi || annulation}>
                  {annulation ? 'Annulation…' : 'Annuler ce brouillon'}
                </button>
                <button className="btn" onClick={envoyerDansLeCircuit} disabled={envoi || annulation}>
                  {envoi ? 'Envoi…' : 'Envoyer dans le circuit de signature'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
