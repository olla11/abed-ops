import PayRollClient from './PayRollClient'

export const dynamic = 'force-dynamic'

export default function CAFPayRollPage() {
  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Pay Roll</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Tous les paiements autorisés par le Directeur Exécutif (demandes simples, allocations,
        timesheets, réconciliations de mission) — passez le statut à « À payer » en choisissant
        le compte, puis générez un appel de fonds pour lancer la signature.
      </p>
      <PayRollClient />
    </div>
  )
}
