import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function StatCard({ label, count, href, color }: { label: string; count: number; href: string; color: string }) {
  return (
    <Link href={href} className="card" style={{
      textDecoration: 'none', color: 'inherit', display: 'block',
      borderLeft: `4px solid ${color}`, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 4 }}>{label}</div>
    </Link>
  )
}

export default async function CAFDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: demandesCount },
    { count: rapportsTraiteAafCount },
    { count: reconciliationsCount },
    { count: timesheetsCount },
    // Rapports soumis par l'AAF lui-même, encore à l'étape "montant à
    // fixer" — il ne peut pas les traiter, ils reviennent directement à la
    // CAF plutôt que de rester coincés dans le tableau de bord AAF.
    { count: rapportsAuteurAafCount },
  ] = await Promise.all([
    supabase.from('demandes_paiement').select('id', { count: 'exact', head: true }).eq('status', 'valide_aaf'),
    supabase.from('rapports_allocations').select('id', { count: 'exact', head: true }).eq('status', 'traite_aaf'),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'reconciliation_caf'),
    supabase.from('soumissions').select('id', { count: 'exact', head: true }).eq('status', 'valide_tech'),
    supabase.from('rapports_allocations')
      .select('id, prestataire:profiles!rapports_allocations_prestataire_id_fkey!inner(role)', { count: 'exact', head: true })
      .eq('status', 'valide_tech').eq('prestataire.role', 'aaf'),
  ])
  const rapportsCount = (rapportsTraiteAafCount ?? 0) + (rapportsAuteurAafCount ?? 0)

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Tableau de bord CAF Pro</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Tout ce que vous traitez pour le compte d&apos;autrui à votre étape propre — CAF, réuni ici :
          demandes de paiement, rapports d&apos;allocation, réconciliations d&apos;ordres de mission et
          timesheets & paiements — chacun dans son propre écran.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 16, marginBottom: 8 }}>
        <StatCard label="Demandes de paiement à valider" count={demandesCount ?? 0} href="/caf/demandes-paiement" color="#b45309" />
        <StatCard label="Rapports d'allocation à valider" count={rapportsCount ?? 0} href="/caf/rapports-allocations" color="#6d28d9" />
        <StatCard label="Réconciliations OM à valider" count={reconciliationsCount ?? 0} href="/caf/reconciliations" color="#1e40af" />
        <StatCard label="Timesheets à valider" count={timesheetsCount ?? 0} href="/caf/timesheets" color="#0f766e" />
      </div>
    </div>
  )
}
