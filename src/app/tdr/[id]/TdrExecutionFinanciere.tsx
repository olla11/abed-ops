'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Paperclip, Upload, FileText, Download } from 'lucide-react'
import { EXECUTION_STATUT_LABELS } from '@/lib/tdr'
import type { Tdr } from './TdrDetailClient'

type Facture = {
  id: string; description: string; montant: number; date_facture: string | null
  fichier_url: string | null; created_at: string
  enregistre_par: { prenoms: string; nom: string } | null
}

type CodeBudgetaire = { id: string; code: string; libelle: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--abed-muted)' }

function fmtMontant(n: number | null | undefined) {
  return (n ?? 0).toLocaleString('fr-FR') + ' FCFA'
}

export default function TdrExecutionFinanciere({ tdr, myId, myRole, myTitre, onChange }: { tdr: Tdr; myId: string; myRole: string; myTitre: string | null; onChange: () => void | Promise<void> }) {
  const isAAF = myRole === 'aaf' || myRole === 'caf' || ['admin', 'superadmin'].includes(myRole)
  const isCAF = myRole === 'caf' || ['admin', 'superadmin'].includes(myRole)
  const isResponsable = tdr.initiateur_id === myId || ['admin', 'superadmin'].includes(myRole)
  const estTresoriere = myTitre === 'tresorier_ca' || ['admin', 'superadmin'].includes(myRole)
  // Archive ZIP complète : réservée à AAF/CAF/DE uniquement, sans exception
  // admin/superadmin ni accès pour le responsable.
  const peutTelechargerArchive = ['aaf', 'caf', 'de'].includes(myRole)

  // Une fois clôturé, plus rien n'est modifiable pour personne — sauf
  // réouverture exceptionnelle autorisée par la trésorière générale du
  // conseil d'administration, sur demande motivée du CAF, et réservée au
  // CAF seul le temps de la correction.
  const enReouverture = tdr.statut === 'cloture' && tdr.reouverte
  const demandeEnAttente = tdr.statut === 'cloture' && !!tdr.reouverture_demandee_par && !tdr.reouverte && !tdr.reouverture_refusee_le
  const demandeRefusee = tdr.statut === 'cloture' && !!tdr.reouverture_refusee_le && !tdr.reouverte
  const peutModifierFactures = (isAAF && tdr.statut === 'actif') || (isCAF && enReouverture)

  const [factures, setFactures] = useState<Facture[]>([])
  const [loadingFactures, setLoadingFactures] = useState(true)

  useEffect(() => {
    fetch(`/api/tdrs/${tdr.id}/factures`).then(r => r.ok ? r.json() : null).then(j => {
      if (j?.data) setFactures(j.data)
      setLoadingFactures(false)
    })
  }, [tdr.id, tdr.montant_depense])

  // ── Paramètres d'exécution (code budgétaire dynamique + dates prévues) ──
  const [codesBudgetaires, setCodesBudgetaires] = useState<CodeBudgetaire[]>([])
  useEffect(() => {
    fetch('/api/config/listes?type=codes_budgetaires').then(r => r.ok ? r.json() : null).then(j => { if (j?.data) setCodesBudgetaires(j.data) })
  }, [])
  const codeConnu = !tdr.code_budgetaire || codesBudgetaires.some(c => c.code === tdr.code_budgetaire)
  const [codeChoisi, setCodeChoisi] = useState(codeConnu ? (tdr.code_budgetaire ?? '') : 'autre')
  const [codeAutre, setCodeAutre] = useState(codeConnu ? '' : (tdr.code_budgetaire ?? ''))
  const [dateDebut, setDateDebut] = useState(tdr.date_debut_prevue ?? '')
  const [dateFin, setDateFin] = useState(tdr.date_fin_prevue ?? '')
  // Normalement figé automatiquement à la signature finale du DE (somme du
  // chapitre budget) — mais reste ajustable par l'AAF pour les TdR
  // antérieurs à cette automatisation, ou dont le budget a été saisi comme
  // tableau collé (texte riche) plutôt que le tableau structuré du chapitre,
  // que le calcul automatique ne sait donc pas lire.
  const [budgetApprouve, setBudgetApprouve] = useState(tdr.budget_total_valide != null ? String(tdr.budget_total_valide) : '')
  const [savingExecution, setSavingExecution] = useState(false)

  async function enregistrerExecution() {
    setSavingExecution(true)
    await fetch(`/api/tdrs/${tdr.id}/execution`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code_budgetaire: codeChoisi === 'autre' ? codeAutre.trim() : codeChoisi,
        date_debut_prevue: dateDebut || null,
        date_fin_prevue: dateFin || null,
        budget_total_valide: budgetApprouve.trim() === '' ? null : Number(budgetApprouve),
      }),
    })
    setSavingExecution(false)
    await onChange()
  }

  // ── Factures ──
  const [showAjouterFacture, setShowAjouterFacture] = useState(false)
  const [description, setDescription] = useState('')
  const [montant, setMontant] = useState('')
  const [dateFacture, setDateFacture] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [erreurFacture, setErreurFacture] = useState('')

  async function ajouterFacture() {
    if (!description.trim()) { setErreurFacture('Description requise.'); return }
    if (!montant || +montant <= 0) { setErreurFacture('Montant invalide.'); return }
    setUploading(true); setErreurFacture('')

    let fichier_url: string | null = null
    if (fichier) {
      const fd = new FormData()
      fd.append('file', fichier)
      fd.append('slot', 'tdr_facture')
      const up = await fetch('/api/timesheets/upload', { method: 'POST', body: fd })
      if (up.ok) { const j = await up.json(); fichier_url = j.path } else { setUploading(false); setErreurFacture('Échec du téléversement du justificatif.'); return }
    }

    const res = await fetch(`/api/tdrs/${tdr.id}/factures`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim(), montant: +montant, date_facture: dateFacture || null, fichier_url }),
    })
    setUploading(false)
    if (res.ok) {
      setShowAjouterFacture(false); setDescription(''); setMontant(''); setDateFacture(''); setFichier(null)
      const r = await fetch(`/api/tdrs/${tdr.id}/factures`)
      if (r.ok) { const j = await r.json(); setFactures(j.data ?? []) }
      await onChange()
    } else {
      const j = await res.json().catch(() => ({})); setErreurFacture(j.error ?? 'Erreur')
    }
  }

  async function supprimerFacture(id: string) {
    if (!window.confirm('Supprimer cette facture ?')) return
    const res = await fetch(`/api/tdrs/${tdr.id}/factures/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFactures(fs => fs.filter(f => f.id !== id))
      await onChange()
    }
  }

  async function voirJustificatif(path: string) {
    const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`)
    if (res.ok) { const j = await res.json(); window.open(j.url, '_blank', 'noopener') }
  }

  // ── Réconciliation ──
  const [rapportTexte, setRapportTexte] = useState(tdr.rapport_reconciliation_texte ?? '')
  const [soumettant, setSoumettant] = useState(false)
  const [erreurReconciliation, setErreurReconciliation] = useState('')

  async function soumettreReconciliation() {
    if (!rapportTexte.trim()) { setErreurReconciliation('Le rapport de réconciliation est obligatoire.'); return }
    setSoumettant(true); setErreurReconciliation('')
    const res = await fetch(`/api/tdrs/${tdr.id}/reconciliation/soumettre`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rapport_texte: rapportTexte.trim() }),
    })
    setSoumettant(false)
    if (res.ok) await onChange()
    else { const j = await res.json().catch(() => ({})); setErreurReconciliation(j.error ?? 'Erreur') }
  }

  const [showRefusCaf, setShowRefusCaf] = useState(false)
  const [commentaireRefusCaf, setCommentaireRefusCaf] = useState('')
  const [traitementCaf, setTraitementCaf] = useState(false)

  async function traiterCaf(action: 'signer' | 'refuser') {
    if (action === 'refuser' && !commentaireRefusCaf.trim()) { setErreurReconciliation('Un motif de refus est requis.'); return }
    setTraitementCaf(true); setErreurReconciliation('')
    const res = await fetch(`/api/tdrs/${tdr.id}/reconciliation/signer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire: commentaireRefusCaf.trim() }),
    })
    setTraitementCaf(false)
    if (res.ok) { setShowRefusCaf(false); setCommentaireRefusCaf(''); await onChange() }
    else { const j = await res.json().catch(() => ({})); setErreurReconciliation(j.error ?? 'Erreur') }
  }

  const [showRefusResponsable, setShowRefusResponsable] = useState(false)
  const [commentaireRefusResponsable, setCommentaireRefusResponsable] = useState('')
  const [traitementResponsable, setTraitementResponsable] = useState(false)

  async function refuserResponsable() {
    if (!commentaireRefusResponsable.trim()) { setErreurReconciliation('Un motif de refus est requis.'); return }
    setTraitementResponsable(true); setErreurReconciliation('')
    const res = await fetch(`/api/tdrs/${tdr.id}/cloturer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refuser', commentaire: commentaireRefusResponsable.trim() }),
    })
    setTraitementResponsable(false)
    if (res.ok) { setShowRefusResponsable(false); setCommentaireRefusResponsable(''); await onChange() }
    else { const j = await res.json().catch(() => ({})); setErreurReconciliation(j.error ?? 'Erreur') }
  }

  // ── Réouverture post-clôture ──
  const [showDemandeReouverture, setShowDemandeReouverture] = useState(false)
  const [motifReouverture, setMotifReouverture] = useState('')
  const [demandantReouverture, setDemandantReouverture] = useState(false)
  const [erreurReouverture, setErreurReouverture] = useState('')

  async function demanderReouverture() {
    if (!motifReouverture.trim()) { setErreurReouverture('Le motif de la demande est obligatoire.'); return }
    setDemandantReouverture(true); setErreurReouverture('')
    const res = await fetch(`/api/tdrs/${tdr.id}/reouverture/demander`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif: motifReouverture.trim() }),
    })
    setDemandantReouverture(false)
    if (res.ok) { setShowDemandeReouverture(false); setMotifReouverture(''); await onChange() }
    else { const j = await res.json().catch(() => ({})); setErreurReouverture(j.error ?? 'Erreur') }
  }

  const [showRefusTresoriere, setShowRefusTresoriere] = useState(false)
  const [commentaireRefusTresoriere, setCommentaireRefusTresoriere] = useState('')
  const [traitantTresoriere, setTraitantTresoriere] = useState(false)

  async function traiterReouverture(action: 'approuver' | 'refuser') {
    if (action === 'refuser' && !commentaireRefusTresoriere.trim()) { setErreurReouverture('Un motif de refus est requis.'); return }
    setTraitantTresoriere(true); setErreurReouverture('')
    const res = await fetch(`/api/tdrs/${tdr.id}/reouverture/traiter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire: commentaireRefusTresoriere.trim() }),
    })
    setTraitantTresoriere(false)
    if (res.ok) { setShowRefusTresoriere(false); setCommentaireRefusTresoriere(''); await onChange() }
    else { const j = await res.json().catch(() => ({})); setErreurReouverture(j.error ?? 'Erreur') }
  }

  const [terminantReouverture, setTerminantReouverture] = useState(false)
  async function terminerReouverture() {
    if (!window.confirm('Reclôturer ce TdR ? Plus personne ne pourra le modifier après.')) return
    setTerminantReouverture(true)
    const res = await fetch(`/api/tdrs/${tdr.id}/reouverture/terminer`, { method: 'POST' })
    setTerminantReouverture(false)
    if (res.ok) await onChange()
  }

  // Rapport de réconciliation corrigé par le CAF pendant une réouverture.
  const [rapportCorrige, setRapportCorrige] = useState(tdr.rapport_reconciliation_texte ?? '')
  const [savingRapportCorrige, setSavingRapportCorrige] = useState(false)
  async function enregistrerRapportCorrige() {
    setSavingRapportCorrige(true)
    await fetch(`/api/tdrs/${tdr.id}/execution`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rapport_reconciliation_texte: rapportCorrige.trim() }),
    })
    setSavingRapportCorrige(false)
    await onChange()
  }

  const budgetTotal = tdr.budget_total_valide ?? 0
  const solde = budgetTotal - (tdr.montant_depense ?? 0)
  const pctConso = budgetTotal > 0 ? Math.round(((tdr.montant_depense ?? 0) / budgetTotal) * 1000) / 10 : 0

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 14px' }}>Suivi financier</h3>

      {/* Paramètres */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Budget approuvé (FCFA)</label>
          {isAAF && tdr.statut === 'actif' ? (
            <input type="number" min={0} style={inputStyle} value={budgetApprouve} onChange={e => setBudgetApprouve(e.target.value)} placeholder="Ex : 416000" />
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtMontant(tdr.budget_total_valide)}</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Code budgétaire</label>
          {isAAF && tdr.statut === 'actif' ? (
            <>
              <select className="select" style={{ width: '100%' }} value={codeChoisi} onChange={e => setCodeChoisi(e.target.value)}>
                <option value="">— Choisir —</option>
                {codesBudgetaires.map(c => <option key={c.id} value={c.code}>{c.code} — {c.libelle}</option>)}
                <option value="autre">Autre…</option>
              </select>
              {codeChoisi === 'autre' && (
                <input style={{ ...inputStyle, marginTop: 6 }} placeholder="Préciser le code" value={codeAutre} onChange={e => setCodeAutre(e.target.value)} />
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{tdr.code_budgetaire ?? '—'}</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Date début prévue</label>
          {isAAF && tdr.statut === 'actif' ? (
            <input type="date" style={inputStyle} value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{tdr.date_debut_prevue ? new Date(tdr.date_debut_prevue).toLocaleDateString('fr-FR') : '—'}</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Date fin prévue</label>
          {isAAF && tdr.statut === 'actif' ? (
            <input type="date" style={inputStyle} value={dateFin} onChange={e => setDateFin(e.target.value)} />
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{tdr.date_fin_prevue ? new Date(tdr.date_fin_prevue).toLocaleDateString('fr-FR') : '—'}</div>
          )}
        </div>
      </div>
      {isAAF && tdr.statut === 'actif' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={enregistrerExecution} disabled={savingExecution}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'white', color: 'var(--abed-green)', border: '1px solid var(--abed-green)', cursor: 'pointer' }}>
            {savingExecution ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </button>
        </div>
      )}

      {/* Résumé financier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>Budget approuvé</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMontant(budgetTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>Montant dépensé</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMontant(tdr.montant_depense)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>Solde</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: solde < 0 ? '#dc2626' : undefined }}>{fmtMontant(solde)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>% consommé</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{pctConso}%</div>
        </div>
      </div>

      {/* Factures */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h4 style={{ fontSize: 13, margin: 0 }}>Factures enregistrées</h4>
          {peutModifierFactures && (
            <button onClick={() => setShowAjouterFacture(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--abed-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
              <Plus size={14} /> Ajouter une facture
            </button>
          )}
        </div>

        {showAjouterFacture && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Description *</label>
                <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Montant (FCFA) *</label>
                <input type="number" style={inputStyle} value={montant} onChange={e => setMontant(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Date facture</label>
                <input type="date" style={inputStyle} value={dateFacture} onChange={e => setDateFacture(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <Paperclip size={13} /> {fichier ? fichier.name : 'Joindre un justificatif (optionnel)'}
                <input type="file" style={{ display: 'none' }} onChange={e => setFichier(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {erreurFacture && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{erreurFacture}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAjouterFacture(false)} style={{ padding: '7px 14px', borderRadius: 8, background: 'white', border: '1px solid var(--abed-border)', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={ajouterFacture} disabled={uploading} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {uploading ? 'Envoi…' : 'Ajouter'}
              </button>
            </div>
          </div>
        )}

        {!loadingFactures && factures.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>Aucune facture enregistrée.</p>}
        {factures.map(f => (
          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{f.description}</div>
              <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                {f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}
                {f.enregistre_par ? ` · saisie par ${f.enregistre_par.prenoms} ${f.enregistre_par.nom}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700 }}>{fmtMontant(f.montant)}</span>
              {f.fichier_url && (
                <button onClick={() => voirJustificatif(f.fichier_url!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', display: 'flex' }} title="Voir le justificatif">
                  <Upload size={14} />
                </button>
              )}
              {peutModifierFactures && (
                <button onClick={() => supprimerFacture(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Réconciliation */}
      <div style={{ paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h4 style={{ fontSize: 13, margin: 0 }}>Réconciliation</h4>
          {tdr.statut === 'cloture' && (
            <div style={{ display: 'flex', gap: 16 }}>
              <a href={`/api/tdrs/${tdr.id}/reconciliation-pdf`} target="_blank" rel="noopener"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--abed-green)', textDecoration: 'none' }}>
                <FileText size={14} /> Rapport PDF
              </a>
              {peutTelechargerArchive && (
                <a href={`/api/tdrs/${tdr.id}/archive-zip`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#2f5496', textDecoration: 'none' }}>
                  <Download size={14} /> Archive complète (.zip)
                </a>
              )}
            </div>
          )}
        </div>

        {tdr.statut === 'actif' && isAAF && (
          <div>
            <label style={labelStyle}>Rapport de réconciliation *</label>
            <textarea className="input" rows={4} style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
              value={rapportTexte} onChange={e => setRapportTexte(e.target.value)}
              placeholder="Synthèse de l'exécution financière : factures enregistrées, écarts constatés, observations…" />
            {erreurReconciliation && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{erreurReconciliation}</div>}
            <button onClick={soumettreReconciliation} disabled={soumettant}
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--abed-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
              {soumettant ? 'Envoi…' : 'Soumettre la réconciliation au CAF'}
            </button>
          </div>
        )}
        {tdr.statut === 'actif' && !isAAF && (
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>Le suivi financier est en cours. Le rapport de réconciliation sera préparé par l&apos;AAF.</p>
        )}

        {(tdr.statut === 'reconciliation_caf' || tdr.statut === 'reconciliation_responsable' || tdr.statut === 'cloture') && (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginBottom: 6 }}>
              Rapport soumis par l&apos;AAF{tdr.reconciliation_soumis_le ? ` le ${new Date(tdr.reconciliation_soumis_le).toLocaleDateString('fr-FR')}` : ''}
              {tdr.execution_statut && ` · ${EXECUTION_STATUT_LABELS[tdr.execution_statut]}`}
            </div>
            {enReouverture && isCAF ? (
              <>
                <textarea className="input" rows={4} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                  value={rapportCorrige} onChange={e => setRapportCorrige(e.target.value)} />
                <button onClick={enregistrerRapportCorrige} disabled={savingRapportCorrige}
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'white', color: 'var(--abed-green)', border: '1px solid var(--abed-green)', cursor: 'pointer' }}>
                  {savingRapportCorrige ? 'Enregistrement…' : 'Enregistrer le rapport corrigé'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{tdr.rapport_reconciliation_texte}</div>
            )}
          </div>
        )}

        {tdr.statut === 'reconciliation_caf' && (
          <div>
            {isCAF ? (
              <>
                {erreurReconciliation && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{erreurReconciliation}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => traiterCaf('signer')} disabled={traitementCaf}
                    style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--abed-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {traitementCaf ? 'Envoi…' : 'Signer'}
                  </button>
                  <button onClick={() => setShowRefusCaf(v => !v)}
                    style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#dc2626', border: '1px solid #dc2626', cursor: 'pointer' }}>
                    Refuser
                  </button>
                </div>
                {showRefusCaf && (
                  <div style={{ marginTop: 10 }}>
                    <textarea className="input" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                      placeholder="Motif du refus" value={commentaireRefusCaf} onChange={e => setCommentaireRefusCaf(e.target.value)} />
                    <button onClick={() => traiterCaf('refuser')} disabled={traitementCaf}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Confirmer le refus
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>En attente de la signature du CAF.</p>
            )}
          </div>
        )}

        {tdr.statut === 'reconciliation_responsable' && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginBottom: 10 }}>
              Signé par le CAF{tdr.reconciliation_caf_signe_le ? ` le ${new Date(tdr.reconciliation_caf_signe_le).toLocaleDateString('fr-FR')}` : ''}.
            </div>
            {isResponsable ? (
              <>
                {erreurReconciliation && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{erreurReconciliation}</div>}
                <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginBottom: 10 }}>
                  Utilisez « Ajuster et clôturer » en haut de page pour signer et clôturer ce TdR, ou refusez le rapport ci-dessous.
                </p>
                <button onClick={() => setShowRefusResponsable(v => !v)}
                  style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#dc2626', border: '1px solid #dc2626', cursor: 'pointer' }}>
                  Refuser
                </button>
                {showRefusResponsable && (
                  <div style={{ marginTop: 10 }}>
                    <textarea className="input" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                      placeholder="Motif du refus" value={commentaireRefusResponsable} onChange={e => setCommentaireRefusResponsable(e.target.value)} />
                    <button onClick={refuserResponsable} disabled={traitementResponsable}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Confirmer le refus
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>En attente de la signature du responsable du TdR.</p>
            )}
          </div>
        )}

        {tdr.statut === 'cloture' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginBottom: 10 }}>
              Clôturé{tdr.reconciliation_responsable_signe_le ? ` le ${new Date(tdr.reconciliation_responsable_signe_le).toLocaleDateString('fr-FR')}` : ''} après signature du responsable. Plus rien n&apos;est modifiable, sauf réouverture exceptionnelle autorisée par la trésorière générale du conseil d&apos;administration.
            </div>

            {erreurReouverture && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{erreurReouverture}</div>}

            {demandeRefusee && (
              <div style={{ background: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 12.5, color: '#991b1b' }}>
                Demande de réouverture refusée par la trésorière générale{tdr.reouverture_refusee_le ? ` le ${new Date(tdr.reouverture_refusee_le).toLocaleDateString('fr-FR')}` : ''}. Motif : {tdr.reouverture_refus_motif}
              </div>
            )}

            {!enReouverture && !demandeEnAttente && isCAF && (
              <div>
                <button onClick={() => setShowDemandeReouverture(v => !v)}
                  style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#b45309', border: '1px solid #b45309', cursor: 'pointer' }}>
                  Demander une réouverture pour correction
                </button>
                {showDemandeReouverture && (
                  <div style={{ marginTop: 10 }}>
                    <textarea className="input" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                      placeholder="Motif de la demande (ex : erreur sur une facture)" value={motifReouverture} onChange={e => setMotifReouverture(e.target.value)} />
                    <button onClick={demanderReouverture} disabled={demandantReouverture}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#b45309', color: 'white', border: 'none', cursor: 'pointer' }}>
                      {demandantReouverture ? 'Envoi…' : 'Envoyer la demande'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {demandeEnAttente && (
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12.5, color: '#92400e', marginBottom: 8 }}>
                  Demande de réouverture envoyée{tdr.reouverture_demandee_le ? ` le ${new Date(tdr.reouverture_demandee_le).toLocaleDateString('fr-FR')}` : ''}. Motif : {tdr.reouverture_motif}
                  <br />En attente de validation de la trésorière générale du conseil d&apos;administration.
                </div>
                {estTresoriere && (
                  <div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => traiterReouverture('approuver')} disabled={traitantTresoriere}
                        style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--abed-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
                        {traitantTresoriere ? 'Envoi…' : 'Approuver'}
                      </button>
                      <button onClick={() => setShowRefusTresoriere(v => !v)}
                        style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#dc2626', border: '1px solid #dc2626', cursor: 'pointer' }}>
                        Refuser
                      </button>
                    </div>
                    {showRefusTresoriere && (
                      <div style={{ marginTop: 10 }}>
                        <textarea className="input" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                          placeholder="Motif du refus" value={commentaireRefusTresoriere} onChange={e => setCommentaireRefusTresoriere(e.target.value)} />
                        <button onClick={() => traiterReouverture('refuser')} disabled={traitantTresoriere}
                          style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>
                          Confirmer le refus
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {enReouverture && (
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12.5, color: '#1e40af', marginBottom: isCAF ? 10 : 0 }}>
                  Réouverture autorisée{tdr.reouverture_autorisee_le ? ` le ${new Date(tdr.reouverture_autorisee_le).toLocaleDateString('fr-FR')}` : ''} par la trésorière générale. Le CAF peut corriger les factures et le rapport de réconciliation ci-dessus.
                </div>
                {isCAF && (
                  <button onClick={terminerReouverture} disabled={terminantReouverture}
                    style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#374151', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {terminantReouverture ? 'Envoi…' : 'Terminer et reclôturer'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
