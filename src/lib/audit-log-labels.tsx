import type { LucideIcon } from 'lucide-react'
import {
  Home, LayoutDashboard, Plane, Clock, CalendarDays, Wallet, PenTool, FileSignature,
  Activity, FolderKanban, FileText, FolderOpen, Users, ClipboardList, Bell, Settings,
  UserCircle, ShieldCheck, FileBarChart, FileDown, BadgeCheck, LogIn, Building2,
  MessageSquare, Trash2, UserPlus, Mail, RefreshCw, Upload, Eye, Banknote, Download,
  HardDrive, Tag, Zap, ScrollText, HelpCircle,
} from 'lucide-react'

export type LogTone = 'read' | 'write' | 'danger'
export type LogDescription = { label: string; Icon: LucideIcon; tone: LogTone }

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

// Ressources génériques (première partie du chemin, page ou API confondues)
const RESOURCE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  accueil: { label: 'Accueil', Icon: Home },
  dashboard: { label: 'Tableau de bord', Icon: LayoutDashboard },
  missions: { label: 'ordres de mission', Icon: Plane },
  'om-pdf': { label: 'PDF d’ordre de mission', Icon: FileDown },
  timesheets: { label: 'timesheets', Icon: Clock },
  conges: { label: 'congés', Icon: CalendarDays },
  demandes: { label: 'demandes de paiement', Icon: Wallet },
  'demandes-paiement': { label: 'demandes de paiement', Icon: Wallet },
  signatures: { label: 'signatures électroniques', Icon: PenTool },
  'mes-contrats': { label: 'mes contrats', Icon: FileSignature },
  contrats: { label: 'contrats', Icon: FileSignature },
  'contrat-pdf': { label: 'PDF de contrat', Icon: FileDown },
  statut: { label: 'statut', Icon: Activity },
  projets: { label: 'projets', Icon: FolderKanban },
  tdr: { label: 'TdR', Icon: FileText },
  tdrs: { label: 'TdR', Icon: FileText },
  ressources: { label: 'ressources', Icon: FolderOpen },
  rh: { label: 'RH', Icon: Users },
  evaluations: { label: 'évaluations', Icon: ClipboardList },
  overview: { label: 'vue d’ensemble', Icon: LayoutDashboard },
  admin: { label: 'administration', Icon: ShieldCheck },
  notifications: { label: 'notifications', Icon: Bell },
  parametres: { label: 'paramètres', Icon: Settings },
  profile: { label: 'profil', Icon: UserCircle },
  profiles: { label: 'profils', Icon: UserCircle },
  'rapports-allocations': { label: 'rapports d’allocation', Icon: FileBarChart },
  config: { label: 'configuration', Icon: Settings },
  verify: { label: 'vérification publique', Icon: BadgeCheck },
  login: { label: 'connexion', Icon: LogIn },
  auth: { label: 'authentification', Icon: LogIn },
  me: { label: 'mon compte', Icon: UserCircle },
  espaces: { label: 'espaces collaboratifs', Icon: Building2 },
  activites: { label: 'activités', Icon: ClipboardList },
  'commentaires-activites': { label: 'commentaires d’activité', Icon: MessageSquare },
  aga: { label: 'assistant IA', Icon: MessageSquare },
  storage: { label: 'stockage', Icon: HardDrive },
  cron: { label: 'tâche planifiée', Icon: RefreshCw },
  fedapay: { label: 'paiement en ligne', Icon: Banknote },
}

// Sous-pages /rh/... et /admin/... (page ou API), plus précises que le générique
const NAMESPACED_META: Record<string, { label: string; Icon: LucideIcon }> = {
  'rh/conges': { label: 'congés (RH)', Icon: CalendarDays },
  'rh/contrats': { label: 'contrats (RH)', Icon: FileSignature },
  'rh/personnel': { label: 'personnel (RH)', Icon: Users },
  'rh/evaluations': { label: 'évaluations (RH)', Icon: ClipboardList },
  'rh/alertes-contrats': { label: 'alertes contrats (RH)', Icon: Bell },
  'rh/export-personnel': { label: 'export personnel (RH)', Icon: Download },
  'rh/update-profile': { label: 'mise à jour profil (RH)', Icon: UserCircle },
  'admin/comptes': { label: 'comptes (admin)', Icon: Users },
  'admin/inscriptions': { label: 'inscriptions (admin)', Icon: UserPlus },
  'admin/roles': { label: 'rôles (admin)', Icon: ShieldCheck },
  'admin/titres': { label: 'titres (admin)', Icon: Tag },
  'admin/actions': { label: 'actions par lot (admin)', Icon: Zap },
  'admin/stockage': { label: 'stockage (admin)', Icon: HardDrive },
  'admin/journal': { label: 'journal d’audit (admin)', Icon: ScrollText },
  'admin/users': { label: 'comptes (admin)', Icon: Users },
  'admin/assign-role': { label: 'accès (admin)', Icon: ShieldCheck },
  'admin/bulk-delete': { label: 'nettoyage de données (admin)', Icon: Trash2 },
  'admin/create-user': { label: 'création de compte (admin)', Icon: UserPlus },
  'admin/send-email': { label: 'email groupé (admin)', Icon: Mail },
  'admin/role-preview': { label: 'simulation de rôle (admin)', Icon: Eye },
}

// Verbe déduit du dernier segment du chemin (routes d'action explicites)
const ACTION_VERBS: Record<string, { verb: string; tone: LogTone }> = {
  signer: { verb: 'a signé', tone: 'write' },
  'signer-employe': { verb: 'a signé (employé)', tone: 'write' },
  'signer-signataire': { verb: 'a signé (signataire)', tone: 'write' },
  sign: { verb: 'a signé', tone: 'write' },
  refuser: { verb: 'a refusé', tone: 'danger' },
  'refuser-employe': { verb: 'a refusé (employé)', tone: 'danger' },
  'refuser-signataire': { verb: 'a refusé (signataire)', tone: 'danger' },
  refuse: { verb: 'a refusé', tone: 'danger' },
  valider: { verb: 'a validé', tone: 'write' },
  'valider-caf': { verb: 'a validé (CAF)', tone: 'write' },
  'valider-tech': { verb: 'a validé (technique)', tone: 'write' },
  'valider-reconciliation': { verb: 'a validé la réconciliation de', tone: 'write' },
  cloturer: { verb: 'a clôturé', tone: 'write' },
  soumettre: { verb: 'a soumis', tone: 'write' },
  resoumettre: { verb: 'a resoumis', tone: 'write' },
  reconcile: { verb: 'a soumis la réconciliation de', tone: 'write' },
  reconciliation: { verb: 'a ouvert la réconciliation de', tone: 'read' },
  'retry-payment': { verb: 'a relancé le paiement de', tone: 'write' },
  'retry-email': { verb: 'a relancé l’email de', tone: 'write' },
  activate: { verb: 'a activé', tone: 'write' },
  role: { verb: 'a changé le rôle sur', tone: 'danger' },
  manager: { verb: 'a assigné un responsable sur', tone: 'write' },
  'assign-role': { verb: 'a changé un accès sur', tone: 'danger' },
  'bulk-delete': { verb: 'a nettoyé', tone: 'danger' },
  'create-user': { verb: 'a créé un compte dans', tone: 'write' },
  'send-email': { verb: 'a envoyé un email groupé depuis', tone: 'write' },
  'role-preview': { verb: 'a simulé un rôle depuis', tone: 'read' },
  reindex: { verb: 'a réindexé', tone: 'write' },
  payer: { verb: 'a marqué payé', tone: 'write' },
  'payer-credit': { verb: 'a marqué payé (crédit)', tone: 'write' },
  renouveler: { verb: 'a renouvelé', tone: 'write' },
  traiter: { verb: 'a traité', tone: 'write' },
  membres: { verb: 'a modifié les membres de', tone: 'write' },
  collaborateurs: { verb: 'a modifié les collaborateurs de', tone: 'write' },
  create: { verb: 'a créé', tone: 'write' },
  document: { verb: 'a consulté le document de', tone: 'read' },
  nom: { verb: 'a renseigné son identité sur', tone: 'write' },
  renvoyer: { verb: 'a renvoyé', tone: 'write' },
  upload: { verb: 'a téléversé un fichier dans', tone: 'write' },
  'upload-avatar': { verb: 'a mis à jour son avatar dans', tone: 'write' },
  'upload-asset': { verb: 'a téléversé un fichier dans', tone: 'write' },
  update: { verb: 'a mis à jour', tone: 'write' },
  declencher: { verb: 'a déclenché', tone: 'write' },
  action: { verb: 'a effectué une action sur', tone: 'write' },
  'etat-paiement-pdf': { verb: 'a généré un PDF d’état de paiement pour', tone: 'read' },
  'signed-url': { verb: 'a généré un lien de fichier pour', tone: 'read' },
  webhook: { verb: 'a reçu un évènement pour', tone: 'read' },
  'mon-solde': { verb: 'a consulté son solde de', tone: 'read' },
}

// Endpoints CRUD génériques ne portant aucun verbe dans l'URL (juste /:id) :
// on déduit l'action de la méthode HTTP pour ces ressources précises.
const METHOD_OVERRIDES: Record<string, Partial<Record<string, { verb: string; tone: LogTone }>>> = {
  'admin/users': {
    PATCH: { verb: 'a archivé un compte dans', tone: 'danger' },
    PUT: { verb: 'a restauré un compte dans', tone: 'write' },
    DELETE: { verb: 'a supprimé définitivement un compte dans', tone: 'danger' },
  },
  tdrs: {
    PATCH: { verb: 'a modifié un', tone: 'write' },
    DELETE: { verb: 'a supprimé un', tone: 'danger' },
  },
  missions: {
    PATCH: { verb: 'a modifié un', tone: 'write' },
    DELETE: { verb: 'a supprimé un', tone: 'danger' },
  },
  ressources: {
    POST: { verb: 'a ajouté une ressource dans', tone: 'write' },
    PATCH: { verb: 'a modifié une ressource dans', tone: 'write' },
    DELETE: { verb: 'a supprimé une ressource dans', tone: 'danger' },
  },
  projets: {
    POST: { verb: 'a créé un', tone: 'write' },
    PATCH: { verb: 'a modifié un', tone: 'write' },
    DELETE: { verb: 'a supprimé un', tone: 'danger' },
  },
  evaluations: {
    PATCH: { verb: 'a mis à jour une', tone: 'write' },
  },
  'rh/contrats': {
    PATCH: { verb: 'a modifié un contrat dans', tone: 'write' },
    DELETE: { verb: 'a supprimé un contrat dans', tone: 'danger' },
  },
}

const GENERIC_VERB: Record<string, { verb: string; tone: LogTone }> = {
  GET: { verb: 'a consulté', tone: 'read' },
  POST: { verb: 'a créé / soumis', tone: 'write' },
  PATCH: { verb: 'a modifié', tone: 'write' },
  PUT: { verb: 'a modifié', tone: 'write' },
  DELETE: { verb: 'a supprimé', tone: 'danger' },
}

function humanizeSegment(seg: string): string {
  return seg.replace(/-/g, ' ')
}

// Résout le module/ressource visé par un chemin, indépendamment de la
// méthode HTTP ou du verbe d'action — utilisé pour regrouper l'activité
// par module (ex: dans le dashboard analytics) sans dupliquer la logique
// de classification de describeLogEntry.
export function resolveModule(rawPath: string): { key: string; label: string; Icon: LucideIcon } {
  const path = rawPath.split('?')[0]
  const segs = path.split('/').filter(Boolean)
  const isApi = segs[0] === 'api'
  const rest = isApi ? segs.slice(1) : segs

  if (rest.length === 0) {
    return { key: 'accueil', label: 'Accueil', Icon: Home }
  }

  let resourceKey = rest[0]
  if ((rest[0] === 'rh' || rest[0] === 'admin') && rest[1] && !isUuid(rest[1])) {
    const nsKey = `${rest[0]}/${rest[1]}`
    if (NAMESPACED_META[nsKey]) resourceKey = nsKey
  }

  const meta = NAMESPACED_META[resourceKey] ?? RESOURCE_META[rest[0]]
    ?? { label: humanizeSegment(rest[rest.length - 1] ?? rest[0]), Icon: HelpCircle }

  return { key: resourceKey, label: meta.label, Icon: meta.Icon }
}

export function describeLogEntry(method: string, rawPath: string): LogDescription {
  const path = rawPath.split('?')[0]
  const segs = path.split('/').filter(Boolean)

  if (segs.length === 0) {
    return { label: 'Accueil', Icon: Home, tone: 'read' }
  }

  const isApi = segs[0] === 'api'
  const rest = isApi ? segs.slice(1) : segs

  if (rest.length === 0) {
    return { label: isApi ? 'Appel API' : 'Accueil', Icon: Home, tone: 'read' }
  }

  // Namespace à deux segments (rh/xxx, admin/xxx) quand pertinent
  let resourceKey = rest[0]
  if ((rest[0] === 'rh' || rest[0] === 'admin') && rest[1] && !isUuid(rest[1])) {
    const nsKey = `${rest[0]}/${rest[1]}`
    if (NAMESPACED_META[nsKey]) resourceKey = nsKey
  }

  const meta = NAMESPACED_META[resourceKey] ?? RESOURCE_META[rest[0]]
    ?? { label: humanizeSegment(rest[rest.length - 1] ?? rest[0]), Icon: HelpCircle }

  const lastSeg = rest[rest.length - 1]

  // 1) verbe explicite dans le chemin (ex: /signer, /valider, /cloturer)
  if (lastSeg && !isUuid(lastSeg) && lastSeg !== resourceKey.split('/').pop() && ACTION_VERBS[lastSeg]) {
    const { verb, tone } = ACTION_VERBS[lastSeg]
    return { label: `${verb} ${meta.label}`, Icon: meta.Icon, tone }
  }
  // le dernier segment EST la ressource elle-même (ex: /api/admin/bulk-delete) : verbe quand même applicable
  if (lastSeg && ACTION_VERBS[lastSeg] && resourceKey.endsWith(lastSeg)) {
    const { verb, tone } = ACTION_VERBS[lastSeg]
    return { label: `${verb} ${meta.label}`, Icon: meta.Icon, tone }
  }

  // 2) endpoint CRUD sur /:id sans verbe : déduit de la méthode pour cette ressource précise
  const override = METHOD_OVERRIDES[resourceKey]?.[method]
  if (override && isApi) {
    return { label: `${override.verb} ${meta.label}`, Icon: meta.Icon, tone: override.tone }
  }

  // 3) API générique : verbe déduit de la méthode HTTP
  if (isApi) {
    const g = GENERIC_VERB[method] ?? GENERIC_VERB.GET
    return { label: `${g.verb} — ${meta.label}`, Icon: meta.Icon, tone: g.tone }
  }

  // 4) simple navigation de page
  const hasId = rest.some(isUuid)
  return {
    label: hasId ? `A consulté le détail — ${meta.label}` : `A consulté — ${meta.label}`,
    Icon: meta.Icon,
    tone: 'read',
  }
}
