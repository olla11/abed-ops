'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, UserPlus, X, Check, Trash2, Send, PenLine, XCircle, Lock } from 'lucide-react'
import { CHAPITRE_CLES, TDR_STATUT_LABELS, SIGNATAIRE_ROLE_LABELS, STATUT_TOUR, type Chapitre, type TdrStatut, type SignataireRole } from '@/lib/tdr'

type Profile = { id: string; nom: string; prenoms: string }
type Signataire = { id: string; role: SignataireRole; profile_id: string | null; ordre: number; statut: string; signe_le: string | null; commentaire: string | null; profile: Profile | null }
type Collaborateur = { id: string; profile_id: string; permission: 'lecture' | 'revision'; profile: Profile | null }
type Tdr = {
  id: string; numero: string | null; titre_activite: string; projet: string | null; periode: string | null
  statut: TdrStatut; initiateur_id: string; responsable_technique_id: string | null
  chapitres: Chapitre[]
  dernier_refus_commentaire: string | null; dernier_refus_le: string | null
  cloture_notes: string | null; cloture_le: string | null
  initiateur: Profile & { fonction: string | null } | null
  responsable_technique: Profile | null
  cloture_par_profile: Profile | null
  collaborateurs: Collaborateur[]
  signataires: Signataire[]
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: '#f3f4f6', color: '#6b7280' },
  en_validation_technique: { bg: '#fffbeb', color: '#92400e' },
  en_validation_caf: { bg: '#fffbeb', color: '#92400e' },
  en_autorisation_de: { bg: '#fffbeb', color: '#92400e' },
  actif: { bg: '#f0fdf4', color: '#16a34a' },
  cloture: { bg: '#f3f4f6', color: '#374151' },
}

function ordonner(chapitres: Chapitre[]): Chapitre[] {
  return CHAPITRE_CLES.map(cle => chapitres.find(c => c.cle === cle)).filter((c): c is Chapitre => !!c)
}

function ChapitreEditor({ chapitre, onChange, readOnly }: { chapitre: Chapitre; onChange: (c: Chapitre) => void; readOnly: boolean }) {
  if (chapitre.type === 'texte') {
    return (
      <textarea
        className="input"
        value={chapitre.texte ?? ''}
        onChange={e => onChange({ ...chapitre, texte: e.target.value })}
        readOnly={readOnly}
        rows={10}
        placeholder="Rédigez ce chapitre... (une ligne vide sépare les paragraphes, commencez une ligne par « - » pour une liste à puces)"
        style={{ ...inputStyle, resize: 'vertical', minHeight: 200 }}
      />
    )
  }

  const tableau = chapitre.tableau ?? { colonnes: [], lignes: [] }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const lignes = tableau.lignes.map((l, i) => i === rowIdx ? l.map((c, j) => j === colIdx ? value : c) : l)
    onChange({ ...chapitre, tableau: { ...tableau, lignes } })
  }
  function updateColonne(colIdx: number, value: string) {
    const colonnes = tableau.colonnes.map((c, i) => i === colIdx ? value : c)
    onChange({ ...chapitre, tableau: { ...tableau, colonnes } })
  }
  function ajouterLigne() {
    onChange({ ...chapitre, tableau: { ...tableau, lignes: [...tableau.lignes, tableau.colonnes.map(() => '')] } })
  }
  function supprimerLigne(rowIdx: number) {
    onChange({ ...chapitre, tableau: { ...tableau, lignes: tableau.lignes.filter((_, i) => i !== rowIdx) } })
  }
  function ajouterColonne() {
    onChange({ ...chapitre, tableau: { colonnes: [...tableau.colonnes, 'Colonne'], lignes: tableau.lignes.map(l => [...l, '']) } })
  }
  function supprimerColonne(colIdx: number) {
    onChange({ ...chapitre, tableau: { colonnes: tableau.colonnes.filter((_, i) => i !== colIdx), lignes: tableau.lignes.map(l => l.filter((_, i) => i !== colIdx)) } })
  }

  return (
    <div>
      <div className="table-wrap">
        <table style={{ minWidth: 500 }}>
          <thead>
            <tr>
              {tableau.colonnes.map((col, i) => (
                <th key={i} style={{ minWidth: 120 }}>
                  {readOnly ? col : (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input value={col} onChange={e => updateColonne(i, e.target.value)} style={{ ...inputStyle, padding: '5px 8px', fontSize: 12, fontWeight: 700 }} />
                      {tableau.colonnes.length > 1 && (
                        <button type="button" onClick={() => supprimerColonne(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><X size={13} /></button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {!readOnly && <th style={{ width: 36 }}></th>}
            </tr>
          </thead>
          <tbody>
            {tableau.lignes.map((ligne, rowIdx) => (
              <tr key={rowIdx}>
                {ligne.map((cell, colIdx) => (
                  <td key={colIdx}>
                    {readOnly ? cell : (
                      <input value={cell} onChange={e => updateCell(rowIdx, colIdx, e.target.value)} style={{ ...inputStyle, padding: '5px 8px', fontSize: 13 }} />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td>
                    <button type="button" onClick={() => supprimerLigne(rowIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><Trash2 size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
            {tableau.lignes.length === 0 && (
              <tr><td colSpan={tableau.colonnes.length + 1} style={{ color: 'var(--abed-muted)', textAlign: 'center', fontSize: 12 }}>Aucune ligne</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" style={{ fontSize: 12 }} onClick={ajouterLigne}>+ Ligne</button>
          <button type="button" className="btn secondary" style={{ fontSize: 12 }} onClick={ajouterColonne}>+ Colonne</button>
        </div>
      )}
    </div>
  )
}

export default function TdrDetailClient({ tdr: initial, myId, myRole, allProfiles }: { tdr: Tdr; myId: string; myRole: string; allProfiles: Profile[] }) {
  const router = useRouter()
  const [tdr, setTdr] = useState(initial)
  const [chapitres, setChapitres] = useState<Chapitre[]>(ordonner(initial.chapitres))
  const [activeIdx, setActiveIdx] = useState(0)
  const [titreActivite, setTitreActivite] = useState(initial.titre_activite)
  const [projet, setProjet] = useState(initial.projet ?? '')
  const [periode, setPeriode] = useState(initial.periode ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [showSoumettre, setShowSoumettre] = useState(false)
  const [responsableTechniqueId, setResponsableTechniqueId] = useState('')
  const [showRefuser, setShowRefuser] = useState(false)
  const [commentaireRefus, setCommentaireRefus] = useState('')
  const [showCloture, setShowCloture] = useState(false)
  const [clotureNotes, setClotureNotes] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [invitePermission, setInvitePermission] = useState<'lecture' | 'revision'>('lecture')
  const [deleteArmed, setDeleteArmed] = useState(false)

  const isInitiateur = tdr.initiateur_id === myId
  const monCollab = tdr.collaborateurs.find(c => c.profile_id === myId)
  const roleAttendu = STATUT_TOUR[tdr.statut]
  const monSignataire = tdr.signataires.find(s => s.role === roleAttendu)
  const estMonTour = !!roleAttendu && monSignataire?.profile_id === myId
  const peutCloturer = tdr.statut === 'actif' && myRole === 'caf'
  const peutTelecharger = tdr.statut === 'actif' || tdr.statut === 'cloture'
  const canEditMeta = tdr.statut === 'brouillon' && (isInitiateur || monCollab?.permission === 'revision')
  const canEdit = canEditMeta || peutCloturer

  const statutColor = STATUT_COLORS[tdr.statut] ?? STATUT_COLORS.brouillon

  async function refresh() {
    router.refresh()
    const res = await fetch(`/api/tdrs/${tdr.id}`)
    if (res.ok) {
      const j = await res.json()
      setTdr(j.data)
      setChapitres(ordonner(j.data.chapitres))
    }
  }

  async function sauvegarder() {
    setSaving(true); setErr('')
    const res = await fetch(`/api/tdrs/${tdr.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre_activite: titreActivite, projet, periode, chapitres }),
    })
    setSaving(false)
    if (res.ok) await refresh()
    else { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'Erreur') }
  }

  async function soumettre() {
    if (!responsableTechniqueId) { setErr('Choisissez un responsable technique.'); return }
    setSaving(true); setErr('')
    const res = await fetch(`/api/tdrs/${tdr.id}/soumettre`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsable_technique_id: responsableTechniqueId }),
    })
    setSaving(false)
    if (res.ok) { setShowSoumettre(false); await refresh() }
    else { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'Erreur') }
  }

  async function signer() {
    setSaving(true); setErr('')
    const res = await fetch(`/api/tdrs/${tdr.id}/signer`, { method: 'POST' })
    setSaving(false)
    if (res.ok) await refresh()
    else { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'Erreur') }
  }

  async function refuser() {
    if (!commentaireRefus.trim()) { setErr('Le motif de refus est requis.'); return }
    setSaving(true); setErr('')
    const res = await fetch(`/api/tdrs/${tdr.id}/refuser`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentaire: commentaireRefus.trim() }),
    })
    setSaving(false)
    if (res.ok) { setShowRefuser(false); setCommentaireRefus(''); await refresh() }
    else { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'Erreur') }
  }

  async function cloturer() {
    setSaving(true); setErr('')
    const res = await fetch(`/api/tdrs/${tdr.id}/cloturer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloture_notes: clotureNotes, chapitres }),
    })
    setSaving(false)
    if (res.ok) { setShowCloture(false); await refresh() }
    else { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'Erreur') }
  }

  async function inviter(profileId: string) {
    const res = await fetch(`/api/tdrs/${tdr.id}/collaborateurs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, permission: invitePermission }),
    })
    if (res.ok) { setInviteSearch(''); await refresh() }
  }

  async function retirerCollaborateur(profileId: string) {
    const res = await fetch(`/api/tdrs/${tdr.id}/collaborateurs`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    if (res.ok) await refresh()
  }

  async function supprimerTdr() {
    const res = await fetch(`/api/tdrs/${tdr.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/tdr')
  }

  const collabIds = new Set(tdr.collaborateurs.map(c => c.profile_id))
  const filteredProfiles = allProfiles.filter(p =>
    p.id !== myId && !collabIds.has(p.id) &&
    (inviteSearch === '' || `${p.prenoms} ${p.nom}`.toLowerCase().includes(inviteSearch.toLowerCase()))
  )

  const active = chapitres[activeIdx]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <a href="/tdr" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Tous les TDR</a>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          {canEditMeta ? (
            <input value={titreActivite} onChange={e => setTitreActivite(e.target.value)}
              style={{ ...inputStyle, fontSize: 20, fontWeight: 800, color: 'var(--abed-green)', border: '1px solid transparent', padding: '4px 0' }} />
          ) : (
            <h2 style={{ color: 'var(--abed-green)', margin: 0, fontSize: 20 }}>{tdr.titre_activite}</h2>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{tdr.numero ?? 'Numéro non attribué'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statutColor.bg, color: statutColor.color }}>
              {TDR_STATUT_LABELS[tdr.statut]}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {peutTelecharger && (
            <a href={`/api/tdrs/${tdr.id}/pdf`} target="_blank" rel="noreferrer"
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--abed-green)', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={15} /> Télécharger le PDF
            </a>
          )}
          {tdr.statut === 'brouillon' && isInitiateur && (
            <button onClick={() => setShowSoumettre(true)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={15} /> Transmettre pour signature
            </button>
          )}
          {estMonTour && (
            <>
              <button onClick={signer} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--abed-green)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PenLine size={15} /> Signer
              </button>
              <button onClick={() => setShowRefuser(true)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#dc2626', border: '1px solid #dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={15} /> Refuser
              </button>
            </>
          )}
          {peutCloturer && (
            <button onClick={() => setShowCloture(true)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#374151', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={15} /> Ajuster et clôturer
            </button>
          )}
          {tdr.statut === 'brouillon' && isInitiateur && (
            deleteArmed ? (
              <button onClick={supprimerTdr} style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>Confirmer la suppression</button>
            ) : (
              <button onClick={() => setDeleteArmed(true)} style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'white', color: '#dc2626', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={15} />
              </button>
            )
          )}
        </div>
      </div>

      {tdr.dernier_refus_commentaire && tdr.statut === 'brouillon' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#991b1b' }}>
          <strong>Dernier refus :</strong> {tdr.dernier_refus_commentaire}
        </div>
      )}

      {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field">
                <label className="label">Projet</label>
                <input className="input" value={projet} onChange={e => setProjet(e.target.value)} readOnly={!canEditMeta} />
              </div>
              <div className="field">
                <label className="label">Date / Période</label>
                <input className="input" value={periode} onChange={e => setPeriode(e.target.value)} readOnly={!canEditMeta} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#f9fafb', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
            {chapitres.map((c, i) => (
              <button key={c.cle} onClick={() => setActiveIdx(i)}
                style={{
                  padding: '8px 14px', fontSize: 12.5, fontWeight: activeIdx === i ? 700 : 500,
                  cursor: 'pointer', border: 'none', borderRadius: 8,
                  background: activeIdx === i ? 'var(--abed-green)' : 'transparent',
                  color: activeIdx === i ? 'white' : '#374151', whiteSpace: 'nowrap',
                }}>
                {i + 1}. {c.titre}
              </button>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {canEdit ? (
                <input value={active.titre} onChange={e => setChapitres(cs => cs.map((c, i) => i === activeIdx ? { ...c, titre: e.target.value } : c))}
                  style={{ ...inputStyle, fontSize: 15, fontWeight: 700, border: '1px solid transparent', padding: '2px 0' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: 15 }}>{activeIdx + 1}. {active.titre}</h3>
              )}
            </div>
            <ChapitreEditor
              chapitre={active}
              readOnly={!canEdit}
              onChange={c => setChapitres(cs => cs.map((cc, i) => i === activeIdx ? c : cc))}
            />
          </div>

          {tdr.statut === 'brouillon' && canEdit && (
            <div style={{ marginTop: 16 }}>
              <button className="btn" disabled={saving} onClick={sauvegarder}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, marginBottom: 12 }}>Circuit de signature</h3>
            {(['initiateur', 'responsable_technique', 'caf', 'de'] as SignataireRole[]).map(role => {
              const s = tdr.signataires.find(sig => sig.role === role)
              const c = s?.statut === 'signe' ? { bg: '#f0fdf4', color: '#16a34a' } : s?.statut === 'refuse' ? { bg: '#fef2f2', color: '#dc2626' } : { bg: '#f3f4f6', color: '#9ca3af' }
              return (
                <div key={role} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginBottom: 2 }}>{SIGNATAIRE_ROLE_LABELS[role]}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s?.profile ? `${s.profile.prenoms} ${s.profile.nom}` : '—'}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                      {s?.statut === 'signe' ? 'Signé' : s?.statut === 'refuse' ? 'Refusé' : 'En attente'}
                    </span>
                  </div>
                  {s?.commentaire && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>« {s.commentaire} »</div>}
                </div>
              )
            })}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, margin: 0 }}>Collaborateurs</h3>
              {isInitiateur && (
                <button onClick={() => setShowInvite(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', display: 'flex' }}>
                  <UserPlus size={16} />
                </button>
              )}
            </div>
            {tdr.collaborateurs.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucun collaborateur.</p>}
            {tdr.collaborateurs.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                <span>{c.profile ? `${c.profile.prenoms} ${c.profile.nom}` : '—'}
                  <span style={{ fontSize: 10, color: 'var(--abed-muted)', marginLeft: 6 }}>({c.permission === 'revision' ? 'révision' : 'lecture'})</span>
                </span>
                {isInitiateur && (
                  <button onClick={() => retirerCollaborateur(c.profile_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={13} /></button>
                )}
              </div>
            ))}
            {showInvite && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="radio" checked={invitePermission === 'lecture'} onChange={() => setInvitePermission('lecture')} /> Lecture
                  </label>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="radio" checked={invitePermission === 'revision'} onChange={() => setInvitePermission('revision')} /> Révision
                  </label>
                </div>
                <input placeholder="Rechercher..." value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} style={{ ...inputStyle, fontSize: 12, marginBottom: 6 }} />
                {inviteSearch && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    {filteredProfiles.slice(0, 8).map(p => (
                      <div key={p.id} onClick={() => inviter(p.id)} style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        {p.prenoms} {p.nom}
                      </div>
                    ))}
                    {filteredProfiles.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--abed-muted)' }}>Aucun résultat</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal : transmettre pour signature */}
      {showSoumettre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Transmettre pour signature</h3>
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 14 }}>
              Choisissez le responsable technique qui approuvera ce TDR avant la CAF et le Directeur Exécutif.
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Responsable technique *</label>
              <select className="select" style={{ width: '100%' }} value={responsableTechniqueId} onChange={e => setResponsableTechniqueId(e.target.value)}>
                <option value="">— Choisir —</option>
                {allProfiles.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
              </select>
            </div>
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSoumettre(false)} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={soumettre} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: '#2563eb', color: 'white', border: 'none', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Envoi…' : 'Transmettre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : refuser */}
      {showRefuser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Refuser ce TDR</h3>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Motif du refus *</label>
              <textarea className="input" rows={3} value={commentaireRefus} onChange={e => setCommentaireRefus(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRefuser(false)} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={refuser} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Envoi…' : 'Refuser et renvoyer à l\'initiateur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : clôturer */}
      {showCloture && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Ajuster et clôturer le TDR</h3>
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 14 }}>
              Vous pouvez ajuster le contenu des chapitres ci-contre avant de clôturer. Cette action est définitive.
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Notes de clôture (optionnel)</label>
              <textarea className="input" rows={3} value={clotureNotes} onChange={e => setClotureNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCloture(false)} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={cloturer} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: '#374151', color: 'white', border: 'none', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Clôture…' : 'Clôturer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
