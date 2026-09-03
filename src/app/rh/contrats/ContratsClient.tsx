'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { FileText, Pencil, MessageSquare, Send, PartyPopper, RotateCcw, Ban, RefreshCw, Trash2, Sparkles, Settings } from 'lucide-react'
import Pagination, { paginate } from '@/components/Pagination'
import { genererDepuisTemplate, formatDateLettres, type ContratTemplate, type ChampTemplate } from '@/lib/contrat-template'

type Article = { titre: string; contenu: string }

type Contrat = {
  id: string; profile_id: string | null; type_contrat: string; poste: string | null
  direction: string | null; date_debut: string; date_fin: string | null
  statut: string; salaire_brut: number | null; observations: string | null
  numero: string | null; categorie_document: string | null
  contrat_parent_id: string | null; renouvele_depuis: string | null; objet: string | null
  articles: Article[] | null
  commentaires_employe: string | null; commentaires_rh: string | null
  commentaires_signataire: string | null
  workflow_statut: string | null; signe_employe_le: string | null
  signataire_id: string | null
  destinataire_email: string | null; destinataire_prenoms: string | null; destinataire_nom: string | null
  lien_externe_expire_le: string | null
  profile: { id: string; nom: string; prenoms: string; email: string | null; role: string } | null
}

// Catégories pour lesquelles la RH peut établir le document en ne
// renseignant qu'un email — utile quand la personne n'a pas encore intégré
// ABED et donc pas encore de compte My ABED (voir /contrats/externe).
function categorieAutoriseDestinataireExterne(categorie: string, typeContrat: string): boolean {
  if (categorie === 'Offre' || categorie === 'Offre de stage') return true
  if (categorie === 'Convention' && ['Bourse de formation', 'Consultant'].includes(typeContrat)) return true
  return false
}

const WF_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  envoye_de:         { label: '✍️ Att. signature DE',      color: '#6d28d9', bg: '#ede9fe' },
  envoye_employe:    { label: '✍️ Att. signature employé', color: '#b45309', bg: '#fef3c7' },
  signe_employe:     { label: '📨 Att. envoi signataire',  color: '#1e40af', bg: '#dbeafe' },
  envoye_signataire: { label: '⏳ Chez le signataire',     color: '#6d28d9', bg: '#ede9fe' },
  signe_signataire:  { label: '✅ Att. finalisation',      color: '#065f46', bg: '#d1fae5' },
  finalise:          { label: '🎉 Finalisé',               color: '#166534', bg: '#dcfce7' },
  rejete_employe:    { label: '↩️ Renvoyé par l\'employé', color: '#b91c1c', bg: '#fee2e2' },
  rejete_signataire: { label: '↩️ Renvoyé par le signataire', color: '#b91c1c', bg: '#fee2e2' },
}
type Personnel = { id: string; nom: string; prenoms: string; role: string; fonction: string | null }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const PAGE_SIZE = 20

const DRAFT_KEY_NEW = 'abed_rh_contrat_draft_new'
const draftKeyEdit = (id: string) => `abed_rh_contrat_draft_edit_${id}`

function loadDraft(key: string): { form: any; articles: Article[]; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveDraft(key: string, form: any, articles: Article[]) {
  try { localStorage.setItem(key, JSON.stringify({ form, articles, savedAt: Date.now() })) } catch {}
}
function clearDraft(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

const TYPES = ['CDD', 'CDI', 'Stage N1', 'Stage N2', 'Bénévolat', 'Prestataire direct', 'Prestataire à crédit', 'Consultant', 'Bourse de formation']
const TYPES_STAGE = ['Stage N1', 'Stage N2']
const CATEGORIES = ['Offre', 'Contrat', 'Convention', 'Avenant', 'Offre de stage']
const SOURCES_FINANCEMENT = ['Expertise France (CLEE-2i)', 'Prometiers', 'ABED Directe', 'Réserve', 'Autre']

// Renouvelable : déjà expiré/résilié, OU encore actif mais dont la fin
// approche (≤30 jours) — pas la peine d'attendre l'expiration effective pour
// s'en occuper, sinon le bouton "Renouveler" ne sert à rien tant qu'on n'a
// pas laissé le contrat lapser.
function estRenouvelable(c: { statut: string; date_fin: string | null }): boolean {
  if (c.statut !== 'actif') return true
  if (!c.date_fin) return false
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  return c.date_fin <= in30
}

function statutBadge(statut: string, dateFin: string | null) {
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  if (statut === 'resilie') return { label: 'Résilié', bg: '#f3f4f6', color: '#6b7280' }
  if (statut === 'expire' || (dateFin && dateFin < today)) return { label: 'Expiré', bg: '#fee2e2', color: '#991b1b' }
  if (dateFin && dateFin <= in7) return { label: 'Expire J-' + Math.ceil((new Date(dateFin).getTime() - Date.now()) / 86400000), bg: '#fef2f2', color: '#dc2626' }
  if (dateFin && dateFin <= in30) return { label: 'Expire bientôt', bg: '#fef3c7', color: '#92400e' }
  return { label: 'Actif', bg: '#dcfce7', color: '#166534' }
}

function categorieBadge(cat: string | null) {
  if (cat === 'Convention') return { bg: '#ede9fe', color: '#6d28d9' }
  if (cat === 'Avenant') return { bg: '#fef3c7', color: '#92400e' }
  return { bg: '#dbeafe', color: '#1e40af' }
}

function Modal({ title, onSubmit, onClose, loading, err, children, wide }: {
  title: string; onSubmit: () => void; onClose: () => void
  loading: boolean; err: string | null; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 28, width: '100%', maxWidth: wide ? 680 : 500, maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: 20, fontSize: 16 }}>{title}</h3>
        {children}
        {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
          <button onClick={onSubmit} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
            {loading ? '...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ArticlesEditor({ articles, onChange }: { articles: Article[]; onChange: (a: Article[]) => void }) {
  function addArticle() { onChange([...articles, { titre: '', contenu: '' }]) }
  function removeArticle(i: number) { onChange(articles.filter((_, idx) => idx !== i)) }
  function updateArticle(i: number, field: 'titre' | 'contenu', val: string) {
    onChange(articles.map((a, idx) => idx === i ? { ...a, [field]: val } : a))
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Articles ({articles.length})</label>
        <button type="button" onClick={addArticle} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontWeight: 700 }}>+ Article</button>
      </div>
      {articles.map((art, i) => (
        <div key={i} style={{ border: '1px solid var(--abed-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--abed-green)' }}>Article {i + 1}</span>
            <button type="button" onClick={() => removeArticle(i)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626' }}>✕</button>
          </div>
          <input placeholder="Titre de l'article..." value={art.titre} onChange={e => updateArticle(i, 'titre', e.target.value)} style={{ ...inputStyle, marginBottom: 6, fontSize: 13 }} />
          <textarea placeholder="Contenu..." value={art.contenu} onChange={e => updateArticle(i, 'contenu', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 13 }} />
        </div>
      ))}
      {articles.length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 8 }}>Aucun article. Cliquez sur « + Article » pour en ajouter.</p>}
    </div>
  )
}

export default function ContratsClient({ contrats: initial, personnel }: { contrats: Contrat[]; personnel: Personnel[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contrats, setContrats] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [editTarget, setEditTarget] = useState<Contrat | null>(null)
  const [renewTarget, setRenewTarget] = useState<Contrat | null>(null)
  const [renewMode, setRenewMode] = useState<'simple' | 'promotion'>('simple')
  const [resilierTarget, setResilierTarget] = useState<Contrat | null>(null)
  const [commentTarget, setCommentTarget] = useState<Contrat | null>(null)
  const [form, setForm] = useState<any>({})
  const [articles, setArticles] = useState<Article[]>([])
  const [motif, setMotif] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deleteStep, setDeleteStep] = useState<Record<string, number>>({})
  const deleteTimers = useState<Record<string, ReturnType<typeof setTimeout>>>(() => ({}))[0]
  const [directions, setDirections] = useState<{ id: string; nom: string }[]>([])
  const [wfTarget, setWfTarget] = useState<Contrat | null>(null)
  const [wfAction, setWfAction] = useState<string>('')
  const [wfSignataireId, setWfSignataireId] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [tauxCaf, setTauxCaf] = useState<{ direct: number; credit: number } | null>(null)
  const [grilles, setGrilles] = useState<{ grade: string; echelon: string; salaire_brut: number; prime_diverses: number }[]>([])
  const [gradeChoisi, setGradeChoisi] = useState('')
  const [echelonChoisi, setEchelonChoisi] = useState('')
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null)
  const [templates, setTemplates] = useState<ContratTemplate[]>([])
  const [champVals, setChampVals] = useState<Record<string, string>>({})
  const [destinataireExterne, setDestinataireExterne] = useState(false)
  const [renvoyerLienLoadingId, setRenvoyerLienLoadingId] = useState<string | null>(null)

  const anyModalOpen = showNew || !!editTarget || !!renewTarget || !!resilierTarget || !!commentTarget || !!wfTarget

  // Sauvegarde automatique du brouillon (nouveau document / modification) dans le navigateur
  useEffect(() => {
    if (!showNew && !editTarget) return
    const key = showNew ? DRAFT_KEY_NEW : draftKeyEdit(editTarget!.id)
    const t = setTimeout(() => saveDraft(key, form, articles), 400)
    return () => clearTimeout(t)
  }, [form, articles, showNew, editTarget])
  useEffect(() => {
    if (anyModalOpen) {
      document.body.classList.add('panel-open')
    } else {
      document.body.classList.remove('panel-open')
    }
    return () => document.body.classList.remove('panel-open')
  }, [anyModalOpen])

  useEffect(() => {
    fetch('/api/config/taux').then(r => r.json()).then(d => setTauxCaf({ direct: d.taux_direct, credit: d.taux_credit })).catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/admin/baremes/salaires').then(r => r.json()).then(j => setGrilles(j.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/config/listes?type=directions').then(r => r.json()).then(j => setDirections(j.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => {
    fetch('/api/rh/contrat-templates').then(r => r.json()).then(j => setTemplates(j.templates ?? [])).catch(() => {})
  }, [])

  // Lien "Renouveler" depuis l'alerte du tableau de bord RH
  // (/rh/contrats?renouveler=<id>) — ouvre directement le formulaire de
  // renouvellement pour ce contrat, sans que la RH ait à le rechercher
  // dans la liste.
  useEffect(() => {
    const idARenouveler = searchParams.get('renouveler')
    if (!idARenouveler) return
    const c = contrats.find(x => x.id === idARenouveler)
    if (c) openRenew(c)
    router.replace('/rh/contrats')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function tauxPourType(type: string | undefined, taux: { direct: number; credit: number } | null): number | null {
    if (!taux) return null
    const t = (type ?? '').toLowerCase()
    if (t.includes('crédit')) return taux.credit
    if (t.includes('prestataire')) return taux.direct
    return null
  }

  function toggleMenu(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (menuOpenId === id) { setMenuOpenId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    // Le menu peut compter jusqu'à ~8 entrées (~330px) — s'il n'y a pas la
    // place de l'ouvrir vers le bas sans sortir du viewport (dernières
    // lignes du tableau), on l'ouvre vers le haut à la place.
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < 330 && rect.top > spaceBelow
    setMenuPos(openUpward
      ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
      : { top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuOpenId(id)
  }

  useEffect(() => {
    if (!menuOpenId) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpenId])

  const filtered = contrats.filter(c => {
    const q = search.toLowerCase()
    const name = c.profile
      ? `${c.profile.prenoms} ${c.profile.nom}`.toLowerCase()
      : `${c.destinataire_prenoms ?? ''} ${c.destinataire_nom ?? ''} ${c.destinataire_email ?? ''}`.toLowerCase()
    return (!q || name.includes(q) || (c.poste ?? '').toLowerCase().includes(q) || (c.numero ?? '').toLowerCase().includes(q)) &&
      (!filterStatut || c.statut === filterStatut) &&
      (!filterCat || (c.categorie_document ?? 'Contrat') === filterCat)
  })

  function activeContractsFor(profileId: string) {
    return contrats.filter(c => c.profile_id === profileId && c.statut === 'actif' && (c.categorie_document ?? 'Contrat') !== 'Avenant')
  }

  function handleEmployeChange(profileId: string) {
    const p = personnel.find(x => x.id === profileId)
    setForm((f: any) => ({ ...f, profile_id: profileId, poste: p?.fonction ?? f.poste ?? '', contrat_parent_id: '' }))
  }

  function openNew() {
    const draft = loadDraft(DRAFT_KEY_NEW)
    if (draft) { setForm(draft.form); setArticles(draft.articles); setDraftRestoredAt(draft.savedAt) }
    else { setForm({ categorie_document: 'Contrat' }); setArticles([]); setDraftRestoredAt(null) }
    setDestinataireExterne(false)
    setErr(null); setShowNew(true)
  }

  function openEdit(c: Contrat) {
    setEditTarget(c)
    const draft = loadDraft(draftKeyEdit(c.id))
    if (draft) { setForm(draft.form); setArticles(draft.articles); setDraftRestoredAt(draft.savedAt) }
    else {
      setForm({ categorie_document: c.categorie_document ?? 'Contrat', type_contrat: c.type_contrat, poste: c.poste ?? '', direction: c.direction ?? '', date_debut: c.date_debut, date_fin: c.date_fin ?? '', salaire_brut: c.salaire_brut ?? '', observations: c.observations ?? '', objet: c.objet ?? '', commentaires_rh: c.commentaires_rh ?? '', source_financement: (c as any).source_financement ?? '' })
      setArticles(Array.isArray(c.articles) ? c.articles : [])
      setDraftRestoredAt(null)
    }
    setErr(null)
  }

  // Renouvellement : pré-rempli depuis l'ancien contrat mais tout reste
  // modifiable (type, poste, direction, salaire...) — même formulaire riche
  // que la modification (formFields(false)), pas juste 2 dates.
  function openRenew(c: Contrat) {
    setRenewTarget(c)
    setRenewMode('simple')
    const today = new Date().toISOString().split('T')[0]
    let nouveauDebut = today
    if (c.date_fin) {
      const lendemain = new Date(c.date_fin)
      lendemain.setDate(lendemain.getDate() + 1)
      const iso = lendemain.toISOString().split('T')[0]
      nouveauDebut = iso > today ? iso : today
    }
    setForm({
      categorie_document: c.categorie_document ?? 'Contrat', type_contrat: c.type_contrat,
      poste: c.poste ?? '', direction: c.direction ?? '', date_debut: nouveauDebut, date_fin: '',
      salaire_brut: c.salaire_brut ?? '', objet: c.objet ?? '', commentaires_rh: '',
      source_financement: (c as any).source_financement ?? '',
    })
    setArticles(Array.isArray(c.articles) ? c.articles : [])
    setDraftRestoredAt(null)
    setErr(null)
  }

  // Bascule entre renouvellement simple (type/poste/salaire repris tels
  // quels de l'ancien contrat, comme avant) et renouvellement + promotion
  // (ces champs sont vidés pour forcer un choix explicite parmi tous les
  // types de contrat, plutôt que de reproposer silencieusement l'ancien).
  function setModeRenouvellement(mode: 'simple' | 'promotion') {
    setRenewMode(mode)
    if (!renewTarget) return
    if (mode === 'promotion') {
      setGradeChoisi(''); setEchelonChoisi('')
      setForm((f: any) => ({
        ...f,
        // Une "Offre de stage"/"Offre" ne peut pas accueillir un CDD/CDI —
        // on bascule vers "Contrat" par défaut pour que tous les types
        // s'affichent immédiatement (la catégorie reste modifiable ci-dessous).
        categorie_document: (f.categorie_document === 'Offre de stage' || f.categorie_document === 'Offre') ? 'Contrat' : f.categorie_document,
        type_contrat: '', poste: '', salaire_brut: '',
        commentaires_rh: f.commentaires_rh || 'Renouvellement avec promotion',
      }))
    } else {
      setForm((f: any) => ({
        ...f, categorie_document: renewTarget.categorie_document ?? 'Contrat',
        type_contrat: renewTarget.type_contrat, poste: renewTarget.poste ?? '',
        salaire_brut: renewTarget.salaire_brut ?? '',
        commentaires_rh: f.commentaires_rh === 'Renouvellement avec promotion' ? '' : f.commentaires_rh,
      }))
    }
  }

  function discardDraft() {
    if (showNew) {
      clearDraft(DRAFT_KEY_NEW)
      setForm({ categorie_document: 'Contrat' }); setArticles([])
    } else if (editTarget) {
      const c = editTarget
      clearDraft(draftKeyEdit(c.id))
      setForm({ categorie_document: c.categorie_document ?? 'Contrat', type_contrat: c.type_contrat, poste: c.poste ?? '', direction: c.direction ?? '', date_debut: c.date_debut, date_fin: c.date_fin ?? '', salaire_brut: c.salaire_brut ?? '', observations: c.observations ?? '', objet: c.objet ?? '', commentaires_rh: c.commentaires_rh ?? '', source_financement: (c as any).source_financement ?? '' })
      setArticles(Array.isArray(c.articles) ? c.articles : [])
    }
    setDraftRestoredAt(null)
  }

  function openComment(c: Contrat) { setCommentTarget(c); setCommentaire(c.commentaires_rh ?? ''); setErr(null) }

  async function createContrat() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/rh/contrats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, articles }) })
      const d = await res.json()
      if (res.ok) { clearDraft(DRAFT_KEY_NEW); setShowNew(false); setForm({}); setArticles([]); setDraftRestoredAt(null); setContrats(c => [d.contrat, ...c]) }
      else setErr(d.error ?? 'Erreur lors de la création')
    } catch { setErr('Erreur réseau — veuillez réessayer') }
    finally { setLoading(false) }
  }

  async function updateContrat() {
    if (!editTarget) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${editTarget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, articles }) })
      const d = await res.json()
      if (res.ok) { clearDraft(draftKeyEdit(editTarget.id)); setContrats(cs => cs.map(c => c.id === editTarget.id ? { ...c, ...d.contrat, articles } : c)); setEditTarget(null); setForm({}); setArticles([]); setDraftRestoredAt(null) }
      else setErr(d.error ?? 'Erreur modification')
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function resilier() {
    if (!resilierTarget) return
    if (!motif || motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${resilierTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resilier', motif }) })
      const d = await res.json()
      if (res.ok) { setContrats(cs => cs.map(c => c.id === resilierTarget.id ? { ...c, statut: 'resilie' } : c)); setResilierTarget(null); setMotif('') }
      else setErr(d.error ?? 'Erreur résiliation')
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function renouveler() {
    if (!renewTarget) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${renewTarget.id}/renouveler`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, articles }) })
      const d = await res.json()
      if (res.ok) {
        setContrats(cs => [d.contrat, ...cs.map(c => c.id === renewTarget.id ? { ...c, statut: 'expire' } : c)])
        setRenewTarget(null); setForm({}); setArticles([])
      } else setErr(d.error ?? 'Erreur lors du renouvellement')
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function saveComment() {
    if (!commentTarget) return
    if (!commentaire || commentaire.trim().length < 2) { setErr('Commentaire trop court.'); return }
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/rh/contrats/${commentTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'commenter', commentaire }) })
      const d = await res.json()
      if (res.ok) { setContrats(cs => cs.map(c => c.id === commentTarget.id ? { ...c, commentaires_rh: d.contrat.commentaires_rh } : c)); setCommentTarget(null); setCommentaire('') }
      else setErr(d.error ?? 'Erreur')
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function doWorkflowAction() {
    if (!wfTarget) return
    const body: any = { action: wfAction }
    if (wfAction === 'envoyer_signataire') {
      if (!wfSignataireId) { setErr('Sélectionnez un signataire.'); return }
      body.signataire_id = wfSignataireId
    }
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/contrats/${wfTarget.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (res.ok) {
        setContrats(cs => cs.map(c => c.id === wfTarget.id ? { ...c, workflow_statut: d.workflow_statut, signataire_id: body.signataire_id ?? c.signataire_id } : c))
        setWfTarget(null); setWfAction(''); setWfSignataireId('')
      } else setErr(d.error ?? 'Erreur')
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function renvoyerLienExterne(id: string) {
    setRenvoyerLienLoadingId(id); setErr(null)
    try {
      const res = await fetch(`/api/contrats/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'renvoyer_lien_externe' }) })
      const d = await res.json()
      if (res.ok) {
        setContrats(cs => cs.map(c => c.id === id ? { ...c, lien_externe_expire_le: d.lien_externe_expire_le } : c))
        alert('Nouveau lien envoyé par email.')
      } else setErr(d.error ?? 'Erreur')
    } catch { setErr('Erreur réseau') }
    finally { setRenvoyerLienLoadingId(null) }
  }

  function advanceDeleteStep(id: string) {
    const next = (deleteStep[id] ?? 1) + 1
    if (next > 3) return
    setDeleteStep(s => ({ ...s, [id]: next }))
    if (deleteTimers[id]) clearTimeout(deleteTimers[id])
    deleteTimers[id] = setTimeout(() => setDeleteStep(s => { const n = { ...s }; delete n[id]; return n }), 5000)
  }

  function resetDeleteStep(id: string) {
    if (deleteTimers[id]) clearTimeout(deleteTimers[id])
    setDeleteStep(s => { const n = { ...s }; delete n[id]; return n })
  }

  async function deleteContrat(id: string) {
    try {
      const res = await fetch(`/api/rh/contrats/${id}`, { method: 'DELETE' })
      if (res.ok) { setContrats(cs => cs.filter(c => c.id !== id)); resetDeleteStep(id) }
      else { const d = await res.json(); alert(d.error ?? 'Erreur'); resetDeleteStep(id) }
    } catch { alert('Erreur réseau'); resetDeleteStep(id) }
  }

  const categorie = form.categorie_document ?? 'Contrat'

  const templateActif = templates.find(t => t.actif && t.type_contrat === form.type_contrat && t.categorie_document === categorie) ?? null

  useEffect(() => {
    if (!templateActif) { setChampVals({}); return }
    const defauts: Record<string, string> = {}
    for (const c of templateActif.champs) defauts[c.cle] = c.defaut ?? ''
    setChampVals(defauts)
  }, [templateActif?.id])

  function genererDepuisModele() {
    if (!templateActif) return
    if (articles.length > 0 && !confirm('Des articles sont déjà présents — les remplacer par le contenu du modèle ?')) return

    const parent = form.contrat_parent_id ? contrats.find(c => c.id === form.contrat_parent_id) : null
    const valeurs: Record<string, string> = {
      ...champVals,
      poste: form.poste ?? '',
      date_debut_texte: formatDateLettres(form.date_debut),
      date_fin_texte: formatDateLettres(form.date_fin),
      date_convention_initiale_texte: parent ? formatDateLettres(parent.date_debut) : '',
    }
    const { objet, articles: articlesGeneres } = genererDepuisTemplate(templateActif, valeurs)
    setForm((f: any) => ({ ...f, objet, template_id: templateActif.id }))
    setArticles(articlesGeneres)
  }

  function champManquant() {
    return templateActif?.champs.some(c => c.requis && !(champVals[c.cle] ?? '').trim()) ?? false
  }

  const formFields = (isNew: boolean, allowCategoryChange = false) => (
    <>
      {isNew && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Employé *</label>
          {(() => {
            const destinataireExterneDisponible = categorieAutoriseDestinataireExterne(categorie, form.type_contrat ?? '')
            const modeExterne = destinataireExterne && destinataireExterneDisponible
            return modeExterne ? (
              <>
                <input type="email" placeholder="email@exemple.com" value={form.destinataire_email ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, destinataire_email: e.target.value, profile_id: '' }))}
                  style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '5px 0 0' }}>
                  La personne recevra un lien sécurisé (valable 72h) pour consulter, signer ou commenter le document — sans compte My ABED. Si elle rejoint ABED plus tard avec cette même adresse email, ce document lui sera automatiquement rattaché.
                </p>
              </>
            ) : (
              <select value={form.profile_id ?? ''} onChange={e => handleEmployeChange(e.target.value)} style={inputStyle}>
                <option value="">— Choisir —</option>
                {personnel.map(p => <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>)}
              </select>
            )
          })()}
          {categorieAutoriseDestinataireExterne(categorie, form.type_contrat ?? '') && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={destinataireExterne}
                onChange={e => { setDestinataireExterne(e.target.checked); setForm((f: any) => ({ ...f, profile_id: '', destinataire_email: '' })) }} />
              Cette personne n&apos;a pas encore de compte My ABED
            </label>
          )}
        </div>
      )}
      {(isNew || allowCategoryChange) && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Catégorie *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} type="button"
                onClick={() => setForm((f: any) => {
                  const allowedTypes = cat === 'Offre de stage' ? TYPES_STAGE : TYPES
                  const typeStillValid = allowedTypes.includes(f.type_contrat)
                  return { ...f, categorie_document: cat, contrat_parent_id: '', type_contrat: typeStillValid ? f.type_contrat : '' }
                })}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700, border: '2px solid', borderColor: categorie === cat ? 'var(--abed-green)' : 'var(--abed-border)', background: categorie === cat ? '#f0fdf4' : 'white', color: categorie === cat ? 'var(--abed-green)' : '#374151' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
      {isNew && categorie === 'Avenant' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Contrat parent (actif) *</label>
          {!form.profile_id ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Sélectionnez d'abord un employé.</p>
          ) : activeContractsFor(form.profile_id).length > 0 ? (
            <select value={form.contrat_parent_id ?? ''} onChange={e => setForm((f: any) => ({ ...f, contrat_parent_id: e.target.value }))} style={inputStyle}>
              <option value="">— Choisir le contrat —</option>
              {activeContractsFor(form.profile_id).map(c => (
                <option key={c.id} value={c.id}>{c.numero ?? c.id.slice(0, 8)} — {c.type_contrat} ({c.date_debut})</option>
              ))}
            </select>
          ) : (
            <p style={{ fontSize: 12, color: '#dc2626', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>
              Cet employé n'a pas de contrat actif. Un avenant requiert un contrat parent actif.
            </p>
          )}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type *</label>
        <select value={form.type_contrat ?? ''} onChange={e => {
          const val = e.target.value
          const taux = tauxPourType(val, tauxCaf)
          setForm((f: any) => ({ ...f, type_contrat: val, salaire_brut: taux != null ? taux : f.salaire_brut }))
        }} style={inputStyle}>
          <option value="">— Choisir —</option>
          {(categorie === 'Offre de stage' ? TYPES_STAGE : TYPES).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {templateActif && (
        <div style={{ border: '1.5px solid var(--abed-green)', background: '#f0fdf4', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={15} color="var(--abed-green)" />
            <strong style={{ fontSize: 13, color: 'var(--abed-green)' }}>Modèle disponible : {templateActif.nom}</strong>
          </div>
          <p style={{ fontSize: 11.5, color: '#374151', margin: '0 0 10px' }}>
            Remplissez les champs ci-dessous, puis générez le texte — vous pourrez encore l'ajuster avant l'envoi.
            Le poste et les dates de début/fin déjà saisis ci-dessus sont repris automatiquement.
          </p>
          {templateActif.champs.map((c: ChampTemplate) => (
            <div key={c.cle} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                {c.libelle}{c.requis ? ' *' : ''}
              </label>
              {c.type === 'textarea' ? (
                <textarea value={champVals[c.cle] ?? ''} onChange={e => setChampVals(v => ({ ...v, [c.cle]: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 13, background: 'white' }} />
              ) : (
                <input type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'} value={champVals[c.cle] ?? ''} onChange={e => setChampVals(v => ({ ...v, [c.cle]: e.target.value }))} style={{ ...inputStyle, fontSize: 13, background: 'white' }} />
              )}
              {c.aide && <p style={{ fontSize: 10.5, color: '#9ca3af', margin: '3px 0 0' }}>{c.aide}</p>}
            </div>
          ))}
          <button type="button" onClick={genererDepuisModele} disabled={champManquant()} style={{
            marginTop: 4, padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: champManquant() ? 'default' : 'pointer',
            background: champManquant() ? '#d1d5db' : 'var(--abed-green)', color: 'white', border: 'none',
          }}>
            Générer les articles à partir du modèle
          </button>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {categorie === 'Offre de stage' || categorie === 'Offre' ? 'Corps de la lettre (modalités, supervision, horaires...)' : 'Objet du document'}
        </label>
        <textarea value={form.objet ?? ''} onChange={e => setForm((f: any) => ({ ...f, objet: e.target.value }))} rows={2}
          placeholder={categorie === 'Offre de stage' || categorie === 'Offre' ? 'Ce texte apparaît tel quel dans le corps de la lettre envoyée au bénéficiaire...' : "Décrivez l'objet de ce document..."}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Poste</label>
        <input value={form.poste ?? ''} onChange={e => setForm((f: any) => ({ ...f, poste: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Direction</label>
        <select value={form.direction ?? ''} onChange={e => setForm((f: any) => ({ ...f, direction: e.target.value }))} style={inputStyle}>
          <option value="">— Choisir —</option>
          {directions.map(d => <option key={d.id} value={d.nom}>{d.nom}</option>)}
          {form.direction && !directions.some(d => d.nom === form.direction) && (
            <option value={form.direction}>{form.direction} (ancienne valeur)</option>
          )}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Source de financement</label>
        <select value={form.source_financement ?? ''} onChange={e => setForm((f: any) => ({ ...f, source_financement: e.target.value }))} style={inputStyle}>
          <option value="">— Non précisée —</option>
          {SOURCES_FINANCEMENT.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date début *</label>
          <input type="date" value={form.date_debut ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date fin</label>
          <input type="date" value={form.date_fin ?? ''} onChange={e => setForm((f: any) => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      {(form.type_contrat ?? '').toLowerCase().includes('prestataire') ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Taux horaire (défini par la CAF)</label>
          <div style={{ ...inputStyle, background: '#f9fafb', color: '#374151', display: 'flex', alignItems: 'center' }}>
            {form.salaire_brut ? `${Number(form.salaire_brut).toLocaleString('fr-FR')} FCFA / heure` : 'Chargement du taux en vigueur...'}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Ce prestataire est payé à l'heure sur la base des feuilles de temps soumises, au taux en vigueur (réglable dans RH → Configuration financière), et non sur un salaire fixe.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {categorie !== 'Offre de stage' && categorie !== 'Offre' && grilles.length > 0 && (
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Grade (grille salariale)</label>
                <select value={gradeChoisi} onChange={e => { setGradeChoisi(e.target.value); setEchelonChoisi('') }} style={inputStyle}>
                  <option value="">— Saisie libre —</option>
                  {[...new Set(grilles.map(g => g.grade))].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Échelon</label>
                <select value={echelonChoisi} disabled={!gradeChoisi} onChange={e => {
                  setEchelonChoisi(e.target.value)
                  const g = grilles.find(x => x.grade === gradeChoisi && x.echelon === e.target.value)
                  if (g) setForm((f: any) => ({ ...f, salaire_brut: g.salaire_brut }))
                }} style={inputStyle}>
                  <option value="">— Choisir —</option>
                  {grilles.filter(g => g.grade === gradeChoisi).map(g => <option key={g.echelon} value={g.echelon}>{g.echelon}</option>)}
                </select>
              </div>
              {gradeChoisi && echelonChoisi && (
                <p style={{ fontSize: 11, color: 'var(--abed-muted)', gridColumn: '1 / -1', margin: 0 }}>
                  Prime diverses associée à {gradeChoisi} {echelonChoisi} : {(grilles.find(g => g.grade === gradeChoisi && g.echelon === echelonChoisi)?.prime_diverses ?? 0).toLocaleString('fr-FR')} FCFA/mois (à ajouter manuellement si elle doit apparaître séparément).
                </p>
              )}
            </div>
          )}
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            {categorie === 'Offre de stage' || categorie === 'Offre' ? 'Allocation mensuelle (FCFA)' : 'Salaire brut (FCFA)'}
          </label>
          <input type="number" value={form.salaire_brut ?? ''} onChange={e => setForm((f: any) => ({ ...f, salaire_brut: e.target.value }))} style={inputStyle} />
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note RH (interne)</label>
        <textarea value={form.commentaires_rh ?? ''} onChange={e => setForm((f: any) => ({ ...f, commentaires_rh: e.target.value }))} rows={2} placeholder="Observations internes RH..." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <ArticlesEditor articles={articles} onChange={setArticles} />
    </>
  )

  return (
    <div className="page-container" onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-delete-btn]')) Object.keys(deleteStep).forEach(id => resetDeleteStep(id)) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Documents RH ({filtered.length})</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/rh/contrats/templates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'white', color: '#374151', border: '1px solid var(--abed-border)', textDecoration: 'none' }}>
            <Settings size={14} /> Modèles
          </Link>
          <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}>
            + Nouveau document
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ ...inputStyle, maxWidth: 240 }} />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }} style={{ ...inputStyle, maxWidth: 160 }}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="expire">Expiré</option>
          <option value="resilie">Résilié</option>
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ minWidth: 1000, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['N°', 'Catégorie', 'Employé', 'Type', 'Poste', 'Début', 'Fin', 'Statut', 'Workflow', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginate(filtered, page, PAGE_SIZE).map((c, i) => {
                const badge = statutBadge(c.statut, c.date_fin)
                const cat = c.categorie_document ?? 'Contrat'
                const catStyle = categorieBadge(cat)
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {c.numero ?? '—'}
                      {c.contrat_parent_id && (() => {
                        const parent = contrats.find(p => p.id === c.contrat_parent_id)
                        return parent ? (
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                            ↳ {parent.numero ?? parent.id.slice(0, 8)}
                          </div>
                        ) : null
                      })()}
                      {c.renouvele_depuis && (() => {
                        const ancien = contrats.find(p => p.id === c.renouvele_depuis)
                        return (
                          <div style={{ fontSize: 10, color: '#0f766e', marginTop: 2 }}>
                            ↻ Renouvellement{ancien ? ` de ${ancien.numero ?? ancien.id.slice(0, 8)}` : ''}
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: catStyle.bg, color: catStyle.color }}>{cat}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {c.profile ? `${c.profile.prenoms} ${c.profile.nom}` : (
                        c.destinataire_prenoms
                          ? <>{c.destinataire_prenoms} {c.destinataire_nom}</>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#6d28d9' }}>
                              ✉️ {c.destinataire_email}
                            </span>
                      )}
                      {!c.profile_id && c.destinataire_email && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: 400 }}>
                          Sans compte — lien {c.lien_externe_expire_le && new Date(c.lien_externe_expire_le) < new Date() ? 'expiré' : `valide jusqu'au ${c.lien_externe_expire_le ? new Date(c.lien_externe_expire_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{c.type_contrat}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.poste ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{c.date_debut}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{c.date_fin ?? 'Indéterminée'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {c.workflow_statut && WF_LABELS[c.workflow_statut] ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: WF_LABELS[c.workflow_statut].bg, color: WF_LABELS[c.workflow_statut].color, whiteSpace: 'nowrap' }}>
                          {WF_LABELS[c.workflow_statut].label}
                        </span>
                      ) : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={(e) => toggleMenu(c.id, e)}
                          title="Actions"
                          style={{
                            width: 30, height: 30, borderRadius: 6, cursor: 'pointer',
                            background: menuOpenId === c.id ? '#f0fdf4' : 'white',
                            border: '1px solid ' + (menuOpenId === c.id ? 'var(--abed-green)' : 'var(--abed-border)'),
                            color: '#374151', fontSize: 16, lineHeight: 1,
                          }}>
                          ⋮
                        </button>
                        {menuOpenId === c.id && menuPos && (
                          <div ref={menuRef} style={{
                            position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, zIndex: 500,
                            background: 'white', border: '1px solid var(--abed-border)', borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,.14)', minWidth: 210, maxHeight: '80vh',
                            display: 'flex', flexDirection: 'column', textAlign: 'left', overflowY: 'auto',
                          }}>
                            <a href={`/api/contrat-pdf/${c.id}`} target="_blank" rel="noreferrer" onClick={() => setMenuOpenId(null)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, color: '#1d4ed8', textDecoration: 'none', borderBottom: '1px solid #f3f4f6' }}>
                              <FileText size={14} /> Voir le PDF
                            </a>
                            {c.statut === 'actif' && !c.profile_id && c.destinataire_email && (
                              <button onClick={() => { renvoyerLienExterne(c.id); setMenuOpenId(null) }} disabled={renvoyerLienLoadingId === c.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#6d28d9', textAlign: 'left' }}>
                                <Send size={14} /> {renvoyerLienLoadingId === c.id ? 'Envoi...' : 'Renvoyer le lien (72h)'}
                              </button>
                            )}
                            {c.statut === 'actif' && (
                              <>
                                <button onClick={() => { openEdit(c); setMenuOpenId(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#374151', textAlign: 'left' }}>
                                  <Pencil size={14} /> Modifier
                                </button>
                                <button onClick={() => { openComment(c); setMenuOpenId(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#166534', textAlign: 'left' }}>
                                  <MessageSquare size={14} /> {c.commentaires_rh ? 'Note (✓ existante)' : 'Ajouter une note'}
                                </button>
                                {['signe_employe','rejete_signataire'].includes(c.workflow_statut ?? '') && (
                                  <button onClick={() => { setWfTarget(c); setWfAction('envoyer_signataire'); setWfSignataireId(c.signataire_id ?? ''); setErr(null); setMenuOpenId(null) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#6d28d9', fontWeight: 700, textAlign: 'left' }}>
                                    <Send size={14} /> {c.workflow_statut === 'rejete_signataire' ? 'Renvoyer au signataire' : 'Envoyer au signataire'}
                                  </button>
                                )}
                                {c.workflow_statut === 'signe_signataire' && (
                                  <button onClick={() => { setWfTarget(c); setWfAction('finaliser'); setErr(null); setMenuOpenId(null) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#166534', fontWeight: 700, textAlign: 'left' }}>
                                    <PartyPopper size={14} /> Finaliser
                                  </button>
                                )}
                                {['envoye_employe','signe_employe','rejete_employe'].includes(c.workflow_statut ?? '') && (
                                  <button onClick={() => { setWfTarget(c); setWfAction('renvoyer_employe'); setErr(null); setMenuOpenId(null) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#b45309', textAlign: 'left' }}>
                                    <RotateCcw size={14} /> Renvoyer à l'employé
                                  </button>
                                )}
                                <button onClick={() => { setResilierTarget(c); setMotif(''); setErr(null); setMenuOpenId(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#dc2626', textAlign: 'left' }}>
                                  <Ban size={14} /> Résilier
                                </button>
                              </>
                            )}
                            {estRenouvelable(c) && (
                              <button onClick={() => { openRenew(c); setMenuOpenId(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', color: '#374151', textAlign: 'left' }}>
                                <RefreshCw size={14} /> Renouveler
                              </button>
                            )}
                            {(() => {
                              const step = deleteStep[c.id] ?? 1
                              if (step === 1) return <button data-delete-btn onClick={() => advanceDeleteStep(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: 'white', border: 'none', color: '#6b7280', textAlign: 'left' }}><Trash2 size={14} /> Supprimer</button>
                              if (step === 2) return <button data-delete-btn onClick={() => advanceDeleteStep(c.id)} style={{ padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: '#fff7ed', border: 'none', color: '#c2410c', fontWeight: 700, textAlign: 'left' }}>Confirmer la suppression ?</button>
                              return <button data-delete-btn onClick={() => deleteContrat(c.id)} style={{ padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', background: '#dc2626', border: 'none', color: 'white', fontWeight: 700, textAlign: 'left' }}>SUPPRIMER définitivement</button>
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun document</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={p => { setPage(p) }} />
        </div>
      </div>

      {showNew && (
        <Modal title="Nouveau document RH" onSubmit={createContrat} onClose={() => { setShowNew(false); setErr(null) }} loading={loading} err={err} wide>
          {draftRestoredAt && (
            <div style={{ fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 6, padding: '8px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span>📝 Brouillon restauré (enregistré le {new Date(draftRestoredAt).toLocaleString('fr-FR')})</span>
              <button type="button" onClick={discardDraft} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: 'white', border: '1px solid #fde68a', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>Effacer</button>
            </div>
          )}
          {formFields(true)}
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Modifier — ${editTarget.profile?.prenoms} ${editTarget.profile?.nom}`} onSubmit={updateContrat} onClose={() => { setEditTarget(null); setErr(null) }} loading={loading} err={err} wide>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>Réf. {editTarget.numero ?? '—'} · {editTarget.categorie_document ?? 'Contrat'}</p>
          {draftRestoredAt && (
            <div style={{ fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 6, padding: '8px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span>📝 Brouillon restauré (enregistré le {new Date(draftRestoredAt).toLocaleString('fr-FR')})</span>
              <button type="button" onClick={discardDraft} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: 'white', border: '1px solid #fde68a', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>Effacer</button>
            </div>
          )}
          {formFields(false)}
        </Modal>
      )}

      {commentTarget && (
        <Modal title={`Note RH — ${commentTarget.profile?.prenoms} ${commentTarget.profile?.nom}`} onSubmit={saveComment} onClose={() => { setCommentTarget(null); setErr(null) }} loading={loading} err={err}>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>Réf. {commentTarget.numero ?? '—'}</p>
          {commentTarget.commentaires_employe && (
            <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', background: '#f9fafb', border: '1px solid var(--abed-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              <strong>Commentaire de l'employé :</strong><br />« {commentTarget.commentaires_employe} »
            </div>
          )}
          {commentTarget.commentaires_signataire && (
            <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              <strong>Motif du signataire (renvoyé sans signer) :</strong><br />« {commentTarget.commentaires_signataire} »
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note / commentaire RH</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={4} placeholder="Observations, retours, demandes de modification..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </Modal>
      )}

      {resilierTarget && (
        <Modal title={`Résilier — ${resilierTarget.profile?.prenoms} ${resilierTarget.profile?.nom}`} onSubmit={resilier} onClose={() => { setResilierTarget(null); setErr(null) }} loading={loading} err={err}>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            {resilierTarget.categorie_document ?? 'Contrat'} <strong>{resilierTarget.type_contrat}</strong> ({resilierTarget.numero ?? '—'})<br />
            <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Cette action est irréversible.</span>
          </p>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motif de résiliation * <span style={{ color: '#9ca3af' }}>(min. 10 caractères)</span></label>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={4} placeholder="Expliquez le motif..." style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: motif.length < 10 ? '#dc2626' : '#16a34a', marginTop: 4 }}>{motif.length} caractères</div>
          </div>
        </Modal>
      )}

      {wfTarget && (
        <Modal
          title={
            wfAction === 'envoyer_signataire' ? `Envoyer au signataire — ${wfTarget.profile?.prenoms} ${wfTarget.profile?.nom}` :
            wfAction === 'finaliser' ? `Finaliser le contrat — ${wfTarget.profile?.prenoms} ${wfTarget.profile?.nom}` :
            `Renvoyer à l'employé — ${wfTarget.profile?.prenoms} ${wfTarget.profile?.nom}`
          }
          onSubmit={doWorkflowAction}
          onClose={() => { setWfTarget(null); setWfAction(''); setWfSignataireId(''); setErr(null) }}
          loading={loading} err={err}
        >
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Réf. {wfTarget.numero ?? '—'} · {wfTarget.categorie_document ?? 'Contrat'} {wfTarget.type_contrat}</p>
          {wfAction === 'envoyer_signataire' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Signataire (DE, PCA ou autre) *</label>
              <select value={wfSignataireId} onChange={e => setWfSignataireId(e.target.value)} style={inputStyle}>
                <option value="">— Choisir un signataire —</option>
                {personnel.filter(p => ['de', 'dp', 'administrateur', 'admin'].includes(p.role)).map(p => (
                  <option key={p.id} value={p.id}>{p.prenoms} {p.nom} ({p.role === 'administrateur' ? 'Président du CA' : p.role.toUpperCase()})</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Le signataire recevra une notification in-app et un email avec un lien vers le document.</p>
            </div>
          )}
          {wfAction === 'finaliser' && (
            <p style={{ fontSize: 14, color: '#374151' }}>
              Le contrat a été signé par toutes les parties. En finalisant, l'employé recevra une notification et un email confirmant que son contrat est disponible.
            </p>
          )}
          {wfAction === 'renvoyer_employe' && (
            <p style={{ fontSize: 14, color: '#374151' }}>
              L'employé recevra une notification et un email lui demandant de signer à nouveau. Sa signature précédente sera réinitialisée.
            </p>
          )}
        </Modal>
      )}

      {renewTarget && (
        <Modal title={`Renouveler — ${renewTarget.profile?.prenoms} ${renewTarget.profile?.nom}`} onSubmit={renouveler} onClose={() => { setRenewTarget(null); setErr(null) }} loading={loading} err={err} wide>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Renouvellement de {renewTarget.categorie_document ?? 'Contrat'} <strong>{renewTarget.type_contrat}</strong> ({renewTarget.numero ?? '—'}) — {renewTarget.statut === 'actif' ? `expire le ${renewTarget.date_fin}` : `expiré le ${renewTarget.date_fin}`}.
            Un nouveau document est créé avec son propre circuit de signature ; l&apos;ancien passe à « Expiré ».
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type de renouvellement</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { key: 'simple', label: 'Renouvellement simple' },
                { key: 'promotion', label: 'Renouvellement & Promotion' },
              ] as const).map(m => (
                <button key={m.key} type="button" onClick={() => setModeRenouvellement(m.key)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700, border: '2px solid', borderColor: renewMode === m.key ? 'var(--abed-green)' : 'var(--abed-border)', background: renewMode === m.key ? '#f0fdf4' : 'white', color: renewMode === m.key ? 'var(--abed-green)' : '#374151' }}>
                  {m.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '6px 0 0' }}>
              {renewMode === 'promotion'
                ? 'La catégorie, le type de contrat, le poste et le salaire ont été réinitialisés — choisissez librement les nouvelles conditions ci-dessous parmi tous les types disponibles.'
                : 'Le type, le poste et le salaire de l’ancien contrat sont repris tels quels — modifiables si besoin.'}
            </p>
          </div>
          {formFields(false, renewMode === 'promotion')}
        </Modal>
      )}
    </div>
  )
}
