'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const SEUIL_PCA = 3_000_000

type BonDeCommande = {
  id: string
  numero: string
  fournisseur_nom: string
  objet: string
  montant_total: number
  statut: 'brouillon' | 'circuit_signature' | 'signe' | 'rejete'
  signataire_role: 'de' | 'pca'
  created_at: string
}

type LigneForm = { jour: string; designation: string; quantite: string; prixUnitaire: string }

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', circuit_signature: 'En signature', signe: 'Signé', rejete: 'Rejeté',
}
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: '#f3f4f6', color: '#374151' },
  circuit_signature: { bg: '#fffbeb', color: '#92400e' },
  signe: { bg: '#f0fdf4', color: '#16a34a' },
  rejete: { bg: '#fef2f2', color: '#991b1b' },
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

function ligneVide(): LigneForm { return { jour: '', designation: '', quantite: '', prixUnitaire: '' } }

export default function BonsDeCommandeClient() {
  const [items, setItems] = useState<BonDeCommande[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [fournisseurNom, setFournisseurNom] = useState('')
  const [fournisseurRccm, setFournisseurRccm] = useState('')
  const [fournisseurIfu, setFournisseurIfu] = useState('')
  const [fournisseurTelephone, setFournisseurTelephone] = useState('')
  const [objet, setObjet] = useState('')
  const [dateLivraison, setDateLivraison] = useState('')
  const [lignes, setLignes] = useState<LigneForm[]>([ligneVide()])
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')

  const [brouillon, setBrouillon] = useState<{ id: string; numero: string; url: string | null } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [annulation, setAnnulation] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/bons-de-commande').then(r => r.json()).then(j => setItems(j.data ?? [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const montantTotal = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
  const signatairePrevu = montantTotal < SEUIL_PCA ? 'Directeur Exécutif' : 'Président du CA'

  function majLigne(i: number, patch: Partial<LigneForm>) {
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function ajouterLigne() { setLignes(ls => [...ls, ligneVide()]) }
  function retirerLigne(i: number) { setLignes(ls => ls.filter((_, idx) => idx !== i)) }

  function fermerForm() {
    setShowForm(false); setFournisseurNom(''); setFournisseurRccm(''); setFournisseurIfu('')
    setFournisseurTelephone(''); setObjet(''); setDateLivraison(''); setLignes([ligneVide()])
    setGenMsg(''); setBrouillon(null)
  }

  async function genererBrouillon() {
    setGenerating(true); setGenMsg('')
    const res = await fetch('/api/bons-de-commande', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fournisseurNom, fournisseurRccm, fournisseurIfu, fournisseurTelephone, objet,
        dateLivraisonSouhaitee: dateLivraison,
        lignes: lignes.map(l => ({ jour: l.jour, designation: l.designation, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })),
      }),
    })
    const j = await res.json()
    setGenerating(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    const docRes = await fetch(`/api/bons-de-commande/${j.bonDeCommandeId}/document`)
    const docJ = await docRes.json()
    setBrouillon({ id: j.bonDeCommandeId, numero: j.numero, url: docJ.url ?? null })
  }

  async function envoyerEnSignature() {
    if (!brouillon) return
    setEnvoi(true); setGenMsg('')
    const res = await fetch(`/api/bons-de-commande/${brouillon.id}/envoyer`, { method: 'POST' })
    const j = await res.json()
    setEnvoi(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    fermerForm(); load()
  }

  async function annulerBrouillon() {
    if (!brouillon) return
    setAnnulation(true); setGenMsg('')
    const res = await fetch(`/api/bons-de-commande/${brouillon.id}`, { method: 'DELETE' })
    const j = await res.json()
    setAnnulation(false)
    if (!res.ok) { setGenMsg(j.error ?? 'Erreur'); return }
    setBrouillon(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nouveau bon de commande
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Aucun bon de commande pour le moment.
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 900, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr>
                <th>N°</th>
                <th>Fournisseur</th>
                <th>Objet</th>
                <th>Montant</th>
                <th>Signataire</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map(bc => (
                <tr key={bc.id}>
                  <td style={{ fontSize: 12, color: 'var(--abed-muted)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{bc.numero}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'normal' }}>{bc.fournisseur_nom}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'normal', lineHeight: 1.35 }}>{bc.objet}</td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(bc.montant_total).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{ fontSize: 12.5 }}>{bc.signataire_role === 'de' ? 'Directeur Exécutif' : 'Président du CA'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: STATUT_COLORS[bc.statut]?.bg, color: STATUT_COLORS[bc.statut]?.color,
                    }}>{STATUT_LABELS[bc.statut]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(17,24,39,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          {!brouillon ? (
            <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 720, padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.35)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--abed-green)' }}>Nouveau bon de commande</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fournisseur *</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={fournisseurNom} onChange={e => setFournisseurNom(e.target.value)} placeholder="Nom du fournisseur" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Téléphone</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={fournisseurTelephone} onChange={e => setFournisseurTelephone(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>RCCM</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={fournisseurRccm} onChange={e => setFournisseurRccm(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>IFU</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={fournisseurIfu} onChange={e => setFournisseurIfu(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Objet *</label>
                <input style={{ ...inputStyle, width: '100%' }} value={objet} onChange={e => setObjet(e.target.value)} placeholder="Objet du bon de commande" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date de livraison souhaitée</label>
                <input style={{ ...inputStyle, width: '100%' }} value={dateLivraison} onChange={e => setDateLivraison(e.target.value)} placeholder="ex : Vendredi 27 et Samedi 28 Février 2026" />
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Lignes *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {lignes.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 2fr 90px 130px 130px 32px', gap: 8, alignItems: 'center' }}>
                    <input style={inputStyle} value={l.jour} onChange={e => majLigne(i, { jour: e.target.value })} placeholder="Jour" />
                    <input style={inputStyle} value={l.designation} onChange={e => majLigne(i, { designation: e.target.value })} placeholder="Désignation" />
                    <input style={inputStyle} type="number" value={l.quantite} onChange={e => majLigne(i, { quantite: e.target.value })} placeholder="Qté" />
                    <input style={inputStyle} type="number" value={l.prixUnitaire} onChange={e => majLigne(i, { prixUnitaire: e.target.value })} placeholder="P.U. FCFA" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>
                      {((Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0)).toLocaleString('fr-FR')}
                    </span>
                    <button onClick={() => retirerLigne(i)} disabled={lignes.length === 1}
                      style={{ background: 'none', border: 'none', cursor: lignes.length === 1 ? 'default' : 'pointer', color: lignes.length === 1 ? '#d1d5db' : '#dc2626' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn secondary" style={{ fontSize: 12.5, marginBottom: 16 }} onClick={ajouterLigne}>+ Ajouter une ligne</button>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px',
                background: '#f9fafb', borderRadius: 8, marginBottom: 16,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total : {montantTotal.toLocaleString('fr-FR')} FCFA</span>
                <span style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>Signataire prévu : <strong>{signatairePrevu}</strong> {montantTotal < SEUIL_PCA ? '(< 3 000 000)' : '(≥ 3 000 000)'}</span>
              </div>

              {genMsg && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{genMsg}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn secondary" onClick={fermerForm} disabled={generating}>Annuler</button>
                <button className="btn" onClick={genererBrouillon} disabled={generating}>
                  {generating ? 'Génération…' : 'Générer le PDF'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 760, padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <h3 style={{ margin: '0 0 6px', color: 'var(--abed-green)' }}>Bon de commande N° {brouillon.numero} — brouillon</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
                Vérifiez le document avant de l&apos;envoyer en signature ({signatairePrevu}). Vous pouvez encore l&apos;annuler.
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
                <button className="btn" onClick={envoyerEnSignature} disabled={envoi || annulation}>
                  {envoi ? 'Envoi…' : 'Envoyer en signature'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
