'use client'
import { useEffect, useState } from 'react'
import { estAAF } from '@/lib/roles'
import { getNiveauFonction } from '@/lib/bareme'

type Rapport = {
  id: string; periode_mois: number; periode_annee: number
  rapport_texte: string; montant_allocation: number | null; status: string
  commentaire_manager: string | null
  prestataire_id: string
  corrige_le: string | null
  prestataire: { nom: string; prenoms: string; type_emploi: string | null; titre: string | null } | null
}

type AllocationBareme = { type_emploi: string; niveau_fonction: string | null; montant_mensuel: number }

const STATUS_FOR_AAF = ['valide_tech']
const STATUS_FOR_CAF = ['traite_aaf']
const STATUS_FOR_DE = ['valide_caf']
const TYPES_NON_SALARIES = ['benevole', 'stagiaire_n1', 'stagiaire_n2']

type Stage = 'aaf' | 'caf' | 'de' | 'manager'

// Montant suggéré par le barème pour un bénévole/stagiaire (Sénior/Medium/
// Junior ne s'appliquent pas ici, seulement le type d'emploi et, pour les
// bénévoles, le niveau de fonction déduit du titre). Reste modifiable par
// l'AAF — certains niveaux de bénévolat n'ont pas de ligne dans le barème,
// auquel cas aucune suggestion n'est proposée et la saisie reste manuelle.
function suggestionBareme(r: Rapport, baremes: AllocationBareme[]): number | null {
  const type = r.prestataire?.type_emploi ?? ''
  if (!TYPES_NON_SALARIES.includes(type)) return null
  if (type === 'benevole') {
    const niveau = getNiveauFonction(r.prestataire?.titre)
    if (!niveau) return null
    const row = baremes.find(b => b.type_emploi === 'benevole' && b.niveau_fonction === niveau)
    return row ? row.montant_mensuel : null
  }
  const row = baremes.find(b => b.type_emploi === type && b.niveau_fonction === null)
  return row ? row.montant_mensuel : null
}

export default function ValidationRapportsAAF({ role, userId, stage }: { role: string; userId?: string; stage?: Stage }) {
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [baremes, setBaremes] = useState<AllocationBareme[]>([])
  const [loading, setLoading] = useState(true)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [montantMap, setMontantMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/rapports-allocations')
    const json = await res.json()
    setRapports(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/admin/baremes/allocations').then(r => r.json()).then(j => setBaremes(j.data ?? [])).catch(() => {})
  }, [])

  // Pré-remplit le montant suggéré par le barème pour les rapports
  // bénévole/stagiaire à l'étape AAF, sans jamais écraser une valeur déjà
  // saisie/modifiée par l'utilisateur.
  useEffect(() => {
    if (!rapports.length || !baremes.length) return
    setMontantMap(prev => {
      let changed = false
      const next = { ...prev }
      for (const r of rapports) {
        if (!STATUS_FOR_AAF.includes(r.status) || next[r.id] !== undefined) continue
        const suggestion = suggestionBareme(r, baremes)
        if (suggestion != null) { next[r.id] = String(suggestion); changed = true }
      }
      return changed ? next : prev
    })
  }, [rapports, baremes])

  function canAct(r: Rapport) {
    // Le/la CAF hérite des droits de l'AAF : distinct des `if`/`return` en
    // chaîne d'origine, sinon un rôle qui correspond à plusieurs étapes
    // (caf = étape AAF + étape CAF) ne testerait jamais que la première.
    const isAAFStage = (estAAF(role) || role === 'admin') && STATUS_FOR_AAF.includes(r.status)
    const isCAFStage = role === 'caf' && STATUS_FOR_CAF.includes(r.status)
    const isDEStage = ['de', 'administrateur'].includes(role) && STATUS_FOR_DE.includes(r.status)
    const isManagerStage = role === 'manager' && r.status === 'soumis'
    // Quand `stage` est fourni (menus AAF / CAF Pro dédiés), on restreint "à
    // traiter" à cette seule étape — la CAF garde un écran dédié à sa propre
    // étape plutôt que de la voir mélangée avec l'étape AAF qu'elle hérite.
    if (stage === 'aaf') return isAAFStage
    if (stage === 'caf') return isCAFStage
    if (stage === 'de') return isDEStage
    if (stage === 'manager') return isManagerStage
    return isAAFStage || isCAFStage || isDEStage || isManagerStage
  }

  async function agir(id: string, action: string) {
    const commentaire = commentMap[id] ?? ''
    const montant = montantMap[id]
    const rapport = rapports.find(r => r.id === id)
    if (action === 'valider' && STATUS_FOR_AAF.includes(rapport?.status ?? '')) {
      if (!montant || +montant <= 0) { alert('Saisissez le montant de l\'allocation.'); return }
    }
    if (action !== 'valider' && action !== 'autoriser' && !commentaire.trim()) {
      alert('Commentaire obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/rapports-allocations/${id}/valider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire, montant_allocation: montant ? +montant : undefined }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  // Personne ne traite son propre dossier, même si son rôle correspondrait
  // techniquement à l'étape courante (ex : l'AAF qui soumet son propre
  // rapport ne peut pas se fixer lui-même son montant d'allocation) — il
  // revient alors naturellement au CAF, qui hérite des droits AAF.
  const aTraiter = rapports.filter(r => r.prestataire_id !== userId && canAct(r))
  if (loading || aTraiter.length === 0) return null

  return (
    <div className="card" style={{ borderLeft: '4px solid #6d28d9' }}>
      <h3 style={{ marginBottom: 4 }}>📋 Rapports d'allocations à traiter ({aTraiter.length})</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
        {(estAAF(role) || role === 'admin') && aTraiter.some(r => STATUS_FOR_AAF.includes(r.status)) && 'Saisissez le montant de l\'allocation et validez.'}
        {role === 'caf' && aTraiter.some(r => STATUS_FOR_CAF.includes(r.status)) && ' Vérifiez et validez les rapports traités par l\'AAF.'}
        {['de', 'administrateur'].includes(role) && 'Autorisez les allocations validées par la CAF.'}
      </p>
      {aTraiter.map(r => {
        const isOpen = expanded === r.id
        const mois = new Date(r.periode_annee, r.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        return (
          <div key={r.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
            {r.corrige_le && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
                padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#92660b', fontWeight: 600,
              }}>
                ⚠️ Mis à jour par {r.prestataire?.prenoms} {r.prestataire?.nom} le{' '}
                {new Date(r.corrige_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {' '}— relisez la nouvelle version avant de traiter.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : r.id)}>
              <div>
                <strong>{r.prestataire?.prenoms} {r.prestataire?.nom}</strong>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 8 }}>
                  {mois} — {r.prestataire?.type_emploi}
                  {r.montant_allocation != null && (
                    <strong style={{ color: 'var(--abed-green)', marginLeft: 8 }}>
                      {r.montant_allocation.toLocaleString('fr-FR')} FCFA
                    </strong>
                  )}
                </span>
              </div>
              <span>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div style={{ background: '#f9fafb', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.rapport_texte}</p>
                </div>
                {r.commentaire_manager && (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: '#374151' }}>
                    Manager : {r.commentaire_manager}
                  </p>
                )}
                {STATUS_FOR_AAF.includes(r.status) && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">
                      {['cdd','cdi'].includes(r.prestataire?.type_emploi ?? '') ? 'Salaire net (FCFA) *' : 'Montant allocation (FCFA) *'}
                    </label>
                    <input className="input" type="number" min={0} style={{ maxWidth: 200 }}
                      value={montantMap[r.id] ?? ''}
                      onChange={e => setMontantMap(m => ({ ...m, [r.id]: e.target.value }))} />
                    {suggestionBareme(r, baremes) != null && (
                      <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
                        Suggéré par le barème — modifiable si nécessaire.
                      </p>
                    )}
                  </div>
                )}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet)</label>
                  <textarea className="input" rows={2} value={commentMap[r.id] ?? ''}
                    onChange={e => setCommentMap(m => ({ ...m, [r.id]: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                    disabled={submitting === r.id}
                    onClick={() => agir(r.id, ['de', 'administrateur'].includes(role) ? 'autoriser' : 'valider')}>
                    {['de', 'administrateur'].includes(role) ? '✓ Autoriser' : '✓ Valider'}
                  </button>
                  <button className="btn danger" style={{ fontSize: 13 }}
                    disabled={submitting === r.id} onClick={() => agir(r.id, 'rejeter')}>
                    Rejeter
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
