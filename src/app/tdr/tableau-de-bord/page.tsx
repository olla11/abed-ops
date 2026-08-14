export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF } from '@/lib/roles'
import { TDR_STATUT_LABELS } from '@/lib/tdr'

type TdrAgrege = {
  statut: string
  projet: string | null
  budget_total_valide: number | null
  montant_depense: number | null
  execution_statut: 'complete' | 'partielle' | null
  initiateur_id: string
  initiateur: { nom: string; prenoms: string } | null
}

type Ligne = { label: string; nb: number; budget: number; depense: number; solde: number; pct: number }

function agreger(label: string, items: TdrAgrege[]): Ligne {
  const budget = items.reduce((s, t) => s + (t.budget_total_valide ?? 0), 0)
  const depense = items.reduce((s, t) => s + (t.montant_depense ?? 0), 0)
  return { label, nb: items.length, budget, depense, solde: budget - depense, pct: budget > 0 ? Math.round((depense / budget) * 1000) / 10 : 0 }
}

function fmt(n: number) { return n.toLocaleString('fr-FR') + ' FCFA' }

function GroupeTable({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  const total = lignes.reduce((acc, l) => ({
    label: 'TOTAL', nb: acc.nb + l.nb, budget: acc.budget + l.budget, depense: acc.depense + l.depense,
    solde: acc.solde + l.solde, pct: 0,
  }), { label: 'TOTAL', nb: 0, budget: 0, depense: 0, solde: 0, pct: 0 } as Ligne)
  total.pct = total.budget > 0 ? Math.round((total.depense / total.budget) * 1000) / 10 : 0

  return (
    <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
      <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>{titre}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--abed-border)', color: 'var(--abed-muted)' }}>
            <th style={{ padding: '6px 8px' }}>—</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Nb TdR</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Budget</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Dépensé</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Solde</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>% exéc.</th>
          </tr>
        </thead>
        <tbody>
          {lignes.filter(l => l.nb > 0).map(l => (
            <tr key={l.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '7px 8px', fontWeight: 600 }}>{l.label}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{l.nb}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(l.budget)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(l.depense)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: l.solde < 0 ? '#dc2626' : undefined }}>{fmt(l.solde)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{l.pct}%</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800 }}>
            <td style={{ padding: '8px' }}>TOTAL</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{total.nb}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.budget)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.depense)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.solde)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{total.pct}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: '16px 20px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default async function TdrTableauDeBordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const realRole = profile?.role ?? 'missionnaire'
  if (!['aaf', 'caf', 'de', 'admin', 'superadmin'].includes(realRole)) redirect('/tdr')

  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  // RLS (tdrs_select / can_access_tdr) accorde déjà une vision globale à
  // de/aaf/caf/administrateur/admin — pas besoin du client admin ici.
  const { data } = await supabase
    .from('tdrs')
    .select('statut, projet, budget_total_valide, montant_depense, execution_statut, initiateur_id, initiateur:profiles!tdrs_initiateur_id_fkey(nom, prenoms)')
  const tdrs = (data ?? []) as unknown as TdrAgrege[]

  const global = agreger('Global', tdrs)
  const enCours = tdrs.filter(t => t.statut === 'actif' || t.statut === 'reconciliation_caf' || t.statut === 'reconciliation_responsable').length
  const clotures = tdrs.filter(t => t.statut === 'cloture').length

  const parStatut: Ligne[] = [
    agreger(TDR_STATUT_LABELS.brouillon, tdrs.filter(t => t.statut === 'brouillon')),
    agreger(TDR_STATUT_LABELS.en_validation_technique, tdrs.filter(t => t.statut === 'en_validation_technique')),
    agreger(TDR_STATUT_LABELS.en_validation_caf, tdrs.filter(t => t.statut === 'en_validation_caf')),
    agreger(TDR_STATUT_LABELS.en_autorisation_de, tdrs.filter(t => t.statut === 'en_autorisation_de')),
    agreger(TDR_STATUT_LABELS.actif, tdrs.filter(t => t.statut === 'actif')),
    agreger(TDR_STATUT_LABELS.reconciliation_caf, tdrs.filter(t => t.statut === 'reconciliation_caf')),
    agreger(TDR_STATUT_LABELS.reconciliation_responsable, tdrs.filter(t => t.statut === 'reconciliation_responsable')),
    agreger('Clôturé — exécution complète', tdrs.filter(t => t.statut === 'cloture' && t.execution_statut === 'complete')),
    agreger('Clôturé — exécution partielle', tdrs.filter(t => t.statut === 'cloture' && t.execution_statut === 'partielle')),
    agreger('Clôturé — non renseigné', tdrs.filter(t => t.statut === 'cloture' && !t.execution_statut)),
  ]

  const projetsMap = new Map<string, TdrAgrege[]>()
  for (const t of tdrs) {
    const cle = t.projet?.trim() || 'Sans projet'
    projetsMap.set(cle, [...(projetsMap.get(cle) ?? []), t])
  }
  const parProjet = [...projetsMap.entries()]
    .map(([label, items]) => agreger(label, items))
    .sort((a, b) => b.nb - a.nb)

  const responsablesMap = new Map<string, { label: string; items: TdrAgrege[] }>()
  for (const t of tdrs) {
    const label = t.initiateur ? `${t.initiateur.prenoms} ${t.initiateur.nom}` : 'Inconnu'
    const entry = responsablesMap.get(t.initiateur_id) ?? { label, items: [] }
    entry.items.push(t)
    responsablesMap.set(t.initiateur_id, entry)
  }
  const parResponsable = [...responsablesMap.values()]
    .map(({ label, items }) => agreger(label, items))
    .sort((a, b) => b.nb - a.nb)

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}

      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <a href="/tdr" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Tous les TdR</a>
        </div>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 18px' }}>Tableau de bord — Suivi financier des TdR</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard label="TdR au total" value={String(global.nb)} color="#374151" />
          <StatCard label="Budget approuvé" value={fmt(global.budget)} color="#2563eb" />
          <StatCard label="Dépensé" value={fmt(global.depense)} color="#b45309" />
          <StatCard label="Solde disponible" value={fmt(global.solde)} color="#16a34a" />
          <StatCard label="% exécution global" value={`${global.pct}%`} color="#6d28d9" />
          <StatCard label="En cours d'exécution" value={String(enCours)} color="#0f766e" />
          <StatCard label="Clôturés" value={String(clotures)} color="#6b7280" />
        </div>

        <GroupeTable titre="Répartition par statut" lignes={parStatut} />
        <GroupeTable titre="Répartition par projet / programme" lignes={parProjet} />
        <GroupeTable titre="Répartition par responsable" lignes={parResponsable} />
      </div>
    </>
  )
}
