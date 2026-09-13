import ExecutionFinanciereClient from './ExecutionFinanciereClient'

export const dynamic = 'force-dynamic'

export default function ExecutionFinancierePage() {
  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Exécution financière</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Budget adopté vs dépenses réellement payées, par ligne budgétaire et par trimestre — mis à jour
        automatiquement à chaque paiement marqué « Payé » dans Pay Roll.
      </p>
      <ExecutionFinanciereClient />
    </div>
  )
}
