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

export default async function AAFDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ count: demandesCount }, { count: rapportsCount }, { count: reconciliationsCount }] = await Promise.all([
    supabase.from('demandes_paiement').select('id', { count: 'exact', head: true }).eq('status', 'soumis'),
    // Exclut les rapports soumis par l'AAF lui-même : il ne peut jamais les
    // traiter (bloqué côté serveur), ils apparaissent directement dans le
    // tableau de bord CAF Pro à la place.
    supabase.from('rapports_allocations')
      .select('id, prestataire:profiles!rapports_allocations_prestataire_id_fkey!inner(role)', { count: 'exact', head: true })
      .eq('status', 'valide_tech').neq('prestataire.role', 'aaf'),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('status', 'reconciliation_aaf'),
  ])

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Tableau de bord AAF</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Tout ce que vous traitez pour le compte d&apos;autrui, réuni ici : demandes de paiement, rapports
          d&apos;allocation et réconciliations d&apos;ordres de mission — chacun dans son propre écran.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 16, marginBottom: 8 }}>
        <StatCard label="Demandes de paiement à traiter" count={demandesCount ?? 0} href="/aaf/demandes-paiement" color="#b45309" />
        <StatCard label="Rapports d'allocation à traiter" count={rapportsCount ?? 0} href="/aaf/rapports-allocations" color="#6d28d9" />
        <StatCard label="Réconciliations OM à valider" count={reconciliationsCount ?? 0} href="/aaf/reconciliations" color="#1e40af" />
      </div>
    </div>
  )
}
