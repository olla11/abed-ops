'use client'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { UserPlus, X, PanelRightOpen, PanelRightClose, Pencil, Trash2, Lock, ArrowUp, ArrowDown, FileSignature } from 'lucide-react'
import RichTextEditor from '@/components/RichTextEditor'
import { createClient as createBrowserClient } from '@/lib/supabase-client'
import { SupabaseYjsProvider, couleurPourUser } from '@/lib/yjs-supabase-provider'
import { amorcerFragmentDepuisHtml } from '@/lib/tdr-collab-seed'

type Profile = { id: string; nom: string; prenoms: string }
type Participant = { id: string; profile_id: string; permission: 'lecture' | 'commentaire' | 'edition'; profile: Profile | null }
type Commentaire = {
  id: string; mark_id: string; texte_cite: string | null; contenu: string
  created_at: string; parent_id: string | null; auteur: Profile | null
}
type Signataire = {
  id: string; profile_id: string | null; email: string | null; nom_externe: string | null
  signe: boolean; signe_le: string | null; est_observateur: boolean; ordre: number | null
  profile: Profile | null
}
type Document = {
  id: string; titre: string; description: string | null; statut: string
  contenu_html: string; fichier_url: string | null; created_at: string; updated_at: string; createur_id: string
  createur: Profile | null; participants: Participant[]; signataires: Signataire[]
}
type LockEntry = { type: 'interne' | 'externe'; value: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
// Le verrouillage réutilise tel quel le statut 'en_attente' du circuit de
// signature existant (voir /api/documents/[id]/verrouiller) — seul le
// libellé affiché ici diffère ("En signature" plutôt que "En attente").
const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', revision: 'En révision', en_attente: 'En signature', complete: 'Terminé', refusee: 'Refusé',
}
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: '#f3f4f6', color: '#6b7280' },
  revision: { bg: '#eff6ff', color: '#2563eb' },
  en_attente: { bg: '#fffbeb', color: '#92400e' },
  complete: { bg: '#f0fdf4', color: '#16a34a' },
  refusee: { bg: '#fef2f2', color: '#dc2626' },
}

function PermissionBadge({ permission }: { permission: string }) {
  const label = permission === 'edition' ? 'édition' : permission === 'commentaire' ? 'commentaire' : 'lecture'
  return <span style={{ fontSize: 10, color: 'var(--abed-muted)', marginLeft: 6 }}>({label})</span>
}

function CommentRow({ c, myId, onDelete }: { c: Commentaire; myId: string; onDelete: (id: string) => void }) {
  const couleur = couleurPourUser(c.auteur?.id ?? c.mark_id)
  const estAuteur = !!c.auteur && c.auteur.id === myId
  return (
    <div style={{ display: 'flex', gap: 8, borderLeft: `3px solid ${couleur}`, paddingLeft: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: couleur, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {(c.auteur ? `${c.auteur.prenoms[0] ?? ''}${c.auteur.nom[0] ?? ''}` : '?').toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{c.auteur ? `${c.auteur.prenoms} ${c.auteur.nom}` : 'Utilisateur supprimé'}</div>
          {estAuteur && (
            <button onClick={() => onDelete(c.id)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 2 }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {c.texte_cite && <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '4px 8px', margin: '4px 0' }}>« {c.texte_cite} »</div>}
        <div style={{ fontSize: 13 }}>{c.contenu}</div>
        <div style={{ fontSize: 10, color: 'var(--abed-muted)', marginTop: 2 }}>
          {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

export default function DocumentDetailClient({ document: initial, myId, allProfiles }: { document: Document; myId: string; allProfiles: Profile[] }) {
  const [document, setDocument] = useState(initial)
  const [contenuHtml, setContenuHtml] = useState(initial.contenu_html)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [invitePermission, setInvitePermission] = useState<'lecture' | 'commentaire' | 'edition'>('commentaire')

  const isCreateur = document.createur_id === myId
  const monParticipant = document.participants.find(p => p.profile_id === myId)
  const canEdit = document.statut === 'revision' && (isCreateur || monParticipant?.permission === 'edition')
  const canComment = document.statut === 'revision' && (isCreateur || monParticipant?.permission === 'edition' || monParticipant?.permission === 'commentaire')
  const statutColor = STATUT_COLORS[document.statut] ?? STATUT_COLORS.brouillon

  const monNom = isCreateur && document.createur ? `${document.createur.prenoms} ${document.createur.nom}`
    : monParticipant?.profile ? `${monParticipant.profile.prenoms} ${monParticipant.profile.nom}` : 'Moi'

  // ── Édition collaborative en temps réel ──
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<SupabaseYjsProvider | null>(null)
  const [collabReady, setCollabReady] = useState(false)

  useEffect(() => {
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const supabase = createBrowserClient()
    const provider = new SupabaseYjsProvider(supabase, `document-${document.id}`, ydoc, {
      id: myId, name: monNom, color: couleurPourUser(myId),
    })
    providerRef.current = provider
    const t = setTimeout(() => {
      amorcerFragmentDepuisHtml(ydoc, 'contenu', contenuHtml || '')
      setCollabReady(true)
    }, 900)
    return () => { clearTimeout(t); provider.destroy(); ydoc.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id])

  // Sauvegarde silencieuse (débounce) du contenu.
  useEffect(() => {
    if (!canEdit) return
    const t = setTimeout(() => { enregistrer(true) }, 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contenuHtml])

  async function enregistrer(silencieux = false) {
    if (!silencieux) setSaving(true)
    await fetch(`/api/documents/${document.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu_html: contenuHtml }),
    })
    if (!silencieux) setSaving(false)
  }

  // ── Temps réel : rafraîchir statut/participants pour tout le monde ──
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`document-live-${document.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demandes_signature', filter: `id=eq.${document.id}` }, () => rafraichir())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_commentaires', filter: `demande_id=eq.${document.id}` }, () => chargerCommentaires())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id])

  async function rafraichir() {
    const res = await fetch(`/api/documents/${document.id}`)
    if (res.ok) { const j = await res.json(); setDocument(j.data) }
  }

  // ── Commentaires ──
  const [commentaires, setCommentaires] = useState<Commentaire[]>([])
  async function chargerCommentaires() {
    const res = await fetch(`/api/documents/${document.id}/commentaires`)
    if (res.ok) { const j = await res.json(); setCommentaires(j.data ?? []) }
  }
  useEffect(() => { chargerCommentaires() }, [document.id])

  const [pendingComment, setPendingComment] = useState<{ markId: string; texteSelectionne: string } | null>(null)
  const [commentaireTexte, setCommentaireTexte] = useState('')

  function creerCommentaire(markId: string, texteSelectionne: string) {
    setPendingComment({ markId, texteSelectionne })
    setCommentaireTexte('')
  }

  async function confirmerCommentaire() {
    if (!pendingComment || !commentaireTexte.trim()) return
    const res = await fetch(`/api/documents/${document.id}/commentaires`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_id: pendingComment.markId, texte_cite: pendingComment.texteSelectionne, contenu: commentaireTexte.trim() }),
    })
    if (res.ok) { setPendingComment(null); setCommentaireTexte(''); chargerCommentaires() }
  }

  async function supprimerCommentaire(id: string) {
    if (!window.confirm('Supprimer ce commentaire ?')) return
    // Pas de route DELETE dédiée en phase 1 — simple retrait visuel local si
    // besoin ; la suppression serveur suivra dans une prochaine itération.
    setCommentaires(cs => cs.filter(c => c.id !== id))
  }

  // ── Participants ──
  const collabIds = new Set(document.participants.map(p => p.profile_id))
  const filteredProfiles = allProfiles.filter(p =>
    p.id !== myId && !collabIds.has(p.id) &&
    (inviteSearch === '' || `${p.prenoms} ${p.nom}`.toLowerCase().includes(inviteSearch.toLowerCase()))
  )

  async function inviter(profileId: string) {
    const res = await fetch(`/api/documents/${document.id}/participants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, permission: invitePermission }),
    })
    if (res.ok) { setInviteSearch(''); rafraichir() }
  }

  async function retirerParticipant(profileId: string) {
    const res = await fetch(`/api/documents/${document.id}/participants`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    if (res.ok) rafraichir()
  }

  // ── Verrouillage pour signature ──
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const [showLockModal, setShowLockModal] = useState(false)
  const [lockEntries, setLockEntries] = useState<LockEntry[]>([])
  const [lockSearch, setLockSearch] = useState('')
  const [lockExternalEmail, setLockExternalEmail] = useState('')
  const [lockSequentiel, setLockSequentiel] = useState(true)
  const [locking, setLocking] = useState(false)
  const [lockErr, setLockErr] = useState<string | null>(null)

  function lockKey(e: LockEntry) { return `${e.type}:${e.value}` }
  function lockLabel(e: LockEntry): string {
    if (e.type === 'externe') return e.value
    const p = allProfiles.find(pp => pp.id === e.value)
    return p ? `${p.prenoms} ${p.nom}` : e.value
  }
  function toggleLockProfile(id: string) {
    setLockEntries(prev => prev.some(e => e.type === 'interne' && e.value === id)
      ? prev.filter(e => !(e.type === 'interne' && e.value === id))
      : [...prev, { type: 'interne', value: id }])
  }
  function addLockExternalEmail() {
    const email = lockExternalEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setLockErr('Adresse email invalide.'); return }
    if (lockEntries.some(e => e.type === 'externe' && e.value === email)) { setLockExternalEmail(''); return }
    setLockEntries(prev => [...prev, { type: 'externe', value: email }])
    setLockExternalEmail(''); setLockErr(null)
  }
  function removeLockEntry(key: string) {
    setLockEntries(prev => prev.filter(e => lockKey(e) !== key))
  }
  function moveLockEntry(idx: number, dir: -1 | 1) {
    setLockEntries(prev => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  async function verrouillerPourSignature() {
    if (lockEntries.length === 0) { setLockErr('Choisissez au moins un signataire.'); return }
    setLocking(true); setLockErr(null)
    const res = await fetch(`/api/documents/${document.id}/verrouiller`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signataires: lockEntries, sequentiel: lockSequentiel }),
    })
    setLocking(false)
    if (res.ok) { setShowLockModal(false); rafraichir() }
    else { const j = await res.json().catch(() => ({})); setLockErr(j.error ?? 'Erreur lors du verrouillage') }
  }

  const filteredLockProfiles = allProfiles.filter(p =>
    p.id !== myId &&
    (lockSearch === '' || `${p.prenoms} ${p.nom}`.toLowerCase().includes(lockSearch.toLowerCase()))
  )

  const monSignataire = document.signataires?.find(s => s.profile_id === myId)
  const signatairesTries = [...(document.signataires ?? [])].filter(s => !s.est_observateur).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))

  return (
    <div className="page-container">
      <div className="tdr-layout">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <a href="/documents" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Documents</a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h2 style={{ color: 'var(--abed-green)', margin: 0, fontSize: 20 }}>{document.titre}</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statutColor.bg, color: statutColor.color }}>
                  {STATUT_LABELS[document.statut] ?? document.statut}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {isCreateur && document.statut === 'revision' && (
                <button onClick={() => setShowLockModal(true)}
                  style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={15} /> Verrouiller pour signature
                </button>
              )}
              <button onClick={() => setPanelOpen(v => !v)}
                style={{
                  padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: panelOpen ? 'var(--abed-green)' : 'white', color: panelOpen ? 'white' : '#374151',
                  border: panelOpen ? 'none' : '1px solid var(--abed-border)', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                Participants &amp; commentaires
                {commentaires.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 20, background: panelOpen ? 'white' : 'var(--abed-green)', color: panelOpen ? 'var(--abed-green)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {commentaires.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {document.statut !== 'revision' && (
            <div style={{ background: statutColor.bg, border: `1px solid ${statutColor.color}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: signatairesTries.length > 0 ? 10 : 0 }}>
                <FileSignature size={16} color={statutColor.color} />
                <span style={{ fontSize: 13, fontWeight: 700, color: statutColor.color }}>
                  {document.statut === 'en_attente' && 'Document verrouillé — en circuit de signature'}
                  {document.statut === 'complete' && 'Document entièrement signé'}
                  {document.statut === 'refusee' && 'Signature refusée par un signataire'}
                </span>
              </div>
              {signatairesTries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {signatairesTries.map((s, i) => (
                    <div key={s.id} style={{ fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{i + 1}.</span>
                      <span>{s.profile ? `${s.profile.prenoms} ${s.profile.nom}` : (s.nom_externe ?? s.email ?? '—')}</span>
                      {s.signe ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ signé</span> : <span style={{ color: '#9ca3af' }}>en attente</span>}
                    </div>
                  ))}
                </div>
              )}
              {document.statut === 'en_attente' && monSignataire && !monSignataire.signe && !monSignataire.est_observateur && (
                <a href={`/signatures/${document.id}/signer`}
                  style={{ display: 'inline-block', padding: '7px 16px', borderRadius: 8, background: 'var(--abed-green)', color: 'white', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                  Aller signer
                </a>
              )}
              {(document.statut === 'complete' || (!monSignataire || monSignataire.signe)) && document.fichier_url && (
                <a href={`/signatures/${document.id}/view`}
                  style={{ display: 'inline-block', padding: '7px 16px', borderRadius: 8, background: 'white', color: statutColor.color, border: `1px solid ${statutColor.color}55`, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                  Voir / télécharger le document
                </a>
              )}
            </div>
          )}

          <div className="card">
            <RichTextEditor
              value={contenuHtml}
              onChange={html => setContenuHtml(html)}
              readOnly={!canEdit}
              collab={collabReady && ydocRef.current && providerRef.current ? {
                doc: ydocRef.current, fragment: 'contenu', provider: providerRef.current,
                user: { name: monNom, color: couleurPourUser(myId) },
              } : undefined}
              onComment={canComment ? (markId, texte) => creerCommentaire(markId, texte) : undefined}
            />
          </div>

          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <button className="btn" disabled={saving} onClick={() => enregistrer()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          )}
        </div>

        {panelOpen && <div className="tdr-panel-backdrop" onClick={() => setPanelOpen(false)} />}
        {panelOpen && (
          <div className="tdr-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--abed-border)' }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Participants &amp; commentaires</h3>
              <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, margin: 0 }}>Participants</h3>
                  {isCreateur && (
                    <button onClick={() => setShowInvite(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--abed-green)', display: 'flex' }}>
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                  <span>{document.createur ? `${document.createur.prenoms} ${document.createur.nom}` : '—'}<span style={{ fontSize: 10, color: 'var(--abed-muted)', marginLeft: 6 }}>(créateur)</span></span>
                </div>
                {document.participants.filter(p => p.profile_id !== document.createur_id).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                    <span>{p.profile ? `${p.profile.prenoms} ${p.profile.nom}` : '—'}<PermissionBadge permission={p.permission} /></span>
                    {isCreateur && (
                      <button onClick={() => retirerParticipant(p.profile_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={13} /></button>
                    )}
                  </div>
                ))}
                {showInvite && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="radio" checked={invitePermission === 'lecture'} onChange={() => setInvitePermission('lecture')} /> Lecture
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="radio" checked={invitePermission === 'commentaire'} onChange={() => setInvitePermission('commentaire')} /> Commentaire
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="radio" checked={invitePermission === 'edition'} onChange={() => setInvitePermission('edition')} /> Édition
                      </label>
                    </div>
                    <input placeholder="Rechercher..." value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} style={{ ...inputStyle, fontSize: 12, marginBottom: 6 }} />
                    {inviteSearch && (
                      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                        {filteredProfiles.slice(0, 8).map(p => (
                          <div key={p.id} onClick={() => inviter(p.id)} style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                            {p.prenoms} {p.nom}
                          </div>
                        ))}
                        {filteredProfiles.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--abed-muted)' }}>Aucun résultat</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={14} /> Commentaires
                </h3>
                {commentaires.filter(c => !c.parent_id).length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: 0 }}>Aucun commentaire. Sélectionnez du texte puis cliquez sur l&apos;icône de commentaire dans la barre d&apos;outils.</p>
                )}
                {commentaires.filter(c => !c.parent_id).map(c => (
                  <div key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <CommentRow c={c} myId={myId} onDelete={supprimerCommentaire} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingComment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>Ajouter un commentaire</h3>
            {pendingComment.texteSelectionne && (
              <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '6px 10px', marginBottom: 14 }}>
                « {pendingComment.texteSelectionne} »
              </div>
            )}
            <textarea rows={3} autoFocus value={commentaireTexte} onChange={e => setCommentaireTexte(e.target.value)} style={{ ...inputStyle, resize: 'vertical', marginBottom: 18 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingComment(null)} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={confirmerCommentaire} disabled={!commentaireTexte.trim()} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700 }}>
                Commenter
              </button>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 4, fontSize: 16 }}>Verrouiller pour signature</h3>
            <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 16px' }}>
              Le contenu actuel sera figé en PDF et envoyé aux signataires choisis. La révision collaborative sera terminée.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Mode de signature</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${lockSequentiel ? '#4f46e5' : 'var(--abed-border)'}`, background: lockSequentiel ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                  <input type="radio" checked={lockSequentiel} onChange={() => setLockSequentiel(true)} /> Séquentielle (l&apos;un après l&apos;autre)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${!lockSequentiel ? '#4f46e5' : 'var(--abed-border)'}`, background: !lockSequentiel ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                  <input type="radio" checked={!lockSequentiel} onChange={() => setLockSequentiel(false)} /> Parallèle (tous en même temps)
                </label>
              </div>
            </div>

            {lockEntries.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Signataires {lockSequentiel ? '(ordre de signature)' : ''}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lockEntries.map((e, i) => (
                    <div key={lockKey(e)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--abed-border)' }}>
                      <span style={{ color: '#9ca3af', minWidth: 16 }}>{i + 1}.</span>
                      <span style={{ flex: 1 }}>{e.type === 'externe' ? '✉️ ' : ''}{lockLabel(e)}</span>
                      {lockSequentiel && (
                        <>
                          <button onClick={() => moveLockEntry(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#d1d5db' : '#6b7280', display: 'flex' }}><ArrowUp size={13} /></button>
                          <button onClick={() => moveLockEntry(i, 1)} disabled={i === lockEntries.length - 1} style={{ background: 'none', border: 'none', cursor: i === lockEntries.length - 1 ? 'default' : 'pointer', color: i === lockEntries.length - 1 ? '#d1d5db' : '#6b7280', display: 'flex' }}><ArrowDown size={13} /></button>
                        </>
                      )}
                      <button onClick={() => removeLockEntry(lockKey(e))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="email" placeholder="email@exterieur.com" value={lockExternalEmail}
                onChange={e => setLockExternalEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLockExternalEmail() } }}
                style={{ ...inputStyle, fontSize: 12.5 }} />
              <button onClick={addLockExternalEmail} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', whiteSpace: 'nowrap' }}>+ Ajouter</button>
            </div>

            <input type="text" placeholder="🔍 Rechercher un nom…" value={lockSearch} onChange={e => setLockSearch(e.target.value)} style={{ ...inputStyle, fontSize: 12.5, marginBottom: 6 }} />
            <div style={{ border: '1px solid var(--abed-border)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', background: '#fafafa', marginBottom: 16 }}>
              {filteredLockProfiles.slice(0, 30).map(p => {
                const selected = lockEntries.some(e => e.type === 'interne' && e.value === p.id)
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', background: selected ? '#eef2ff' : 'transparent', borderBottom: '1px solid #f3f4f6' }}>
                    <input type="checkbox" checked={selected} onChange={() => toggleLockProfile(p.id)} style={{ accentColor: '#4f46e5' }} />
                    {p.prenoms} {p.nom}
                  </label>
                )
              })}
              {filteredLockProfiles.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--abed-muted)' }}>Aucun résultat</div>}
            </div>

            {lockErr && <div style={{ color: '#c0392b', fontSize: 12.5, marginBottom: 12 }}>{lockErr}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLockModal(false)} disabled={locking} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={verrouillerPourSignature} disabled={locking || lockEntries.length === 0} style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: locking ? 0.7 : 1 }}>
                {locking ? 'Verrouillage…' : 'Verrouiller et envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .tdr-layout { display: flex; gap: 20px; align-items: stretch; }
        .tdr-panel {
          flex: 0 0 380px; width: 380px; max-width: 92vw;
          position: sticky; top: 20px;
          max-height: calc(100dvh - 40px); overflow: hidden;
          background: var(--abed-card, white); box-shadow: 0 6px 28px rgba(0,0,0,.14);
          border-radius: 12px; border: 1px solid var(--abed-border);
          display: flex; flex-direction: column;
        }
        .tdr-panel-backdrop { display: none; }
        @media (max-width: 900px) {
          .tdr-layout { display: block; }
          .tdr-panel {
            position: fixed; inset: 0; top: 0; right: 0; width: 100vw; max-width: 100vw;
            height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; z-index: 600;
          }
          .tdr-panel-backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 590; }
        }
      `}</style>
    </div>
  )
}
