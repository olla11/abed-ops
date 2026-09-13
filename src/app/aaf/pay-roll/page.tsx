import AAFPayRollClient from './AAFPayRollClient'

export const dynamic = 'force-dynamic'

export default function AAFPayRollPage() {
  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Pay Roll — Paiements à exécuter</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Paiements dont l&apos;appel de fonds a été signé (DE → TG CA → PCA) — établissez les chèques puis
        marquez chaque ligne « Payé ». Le bénéficiaire est notifié automatiquement.
      </p>
      <AAFPayRollClient />
    </div>
  )
}
