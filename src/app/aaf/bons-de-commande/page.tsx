import BonsDeCommandeClient from './BonsDeCommandeClient'

export const dynamic = 'force-dynamic'

export default function BonsDeCommandePage() {
  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Bon de commande</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Émettez un bon de commande — il part en signature au Directeur Exécutif si le montant est
        inférieur à 3 000 000 FCFA, ou au Président du Conseil d&apos;Administration au-delà.
      </p>
      <BonsDeCommandeClient />
    </div>
  )
}
