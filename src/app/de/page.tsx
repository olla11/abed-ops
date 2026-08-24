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

export default async function DEDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: omASignerCount },
    { count: demandesCount },
    { count: rapportsCount },
    { count: reconciliationsCount },
    { count: timesheetsCount },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select('id, missionnaire:profiles!missions_missionnaire_id_fkey!inner(role)', { count: 'exact', head: true })
      .in('status', ['soumis', 'brouillon'])
      .neq('missionnaire.role', 'de'),
    supabase.from('demandes_paiement').select('id', { count: 'exact', head: true }).eq('status', 'valide_caf'),
    supabase.from('rapports_allocations').select('id', { count: 'exact', head: true }).eq('status', 'valide_caf'),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'reconciliation_de'),
    supabase.from('soumissions').select('id', { count: 'exact', head: true }).eq('status', 'valide_caf'),
  ])

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Tableau de bord DE</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Tout ce que vous traitez pour le compte d&apos;autrui à votre étape propre — DE, réuni ici :
          ordres de mission à signer, demandes de paiement, rapports d&apos;allocation, réconciliations
          d&apos;ordres de mission et timesheets — chacun dans son propre écran.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 16, marginBottom: 8 }}>
        <StatCard label="Ordres de mission à signer" count={omASignerCount ?? 0} href="/de/om-a-signer" color="#166534" />
        <StatCard label="Demandes de paiement à autoriser" count={demandesCount ?? 0} href="/de/demandes-paiement" color="#b45309" />
        <StatCard label="Rapports d'allocation à autoriser" count={rapportsCount ?? 0} href="/de/rapports-allocations" color="#6d28d9" />
        <StatCard label="Réconciliations OM à autoriser" count={reconciliationsCount ?? 0} href="/de/reconciliations" color="#1e40af" />
        <StatCard label="Timesheets à autoriser" count={timesheetsCount ?? 0} href="/de/timesheets" color="#0f766e" />
      </div>
    </div>
  )
}
