import LegalPageLayout, { Toc } from '@/components/LegalPageLayout'
import { PolitiqueBody, POLITIQUE_TOC, LEGAL_UPDATED_AT } from '@/lib/legal-content'

export const metadata = { title: 'Politique de confidentialité — My ABED' }

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalPageLayout title="Politique de confidentialité et de protection des données" updatedAt={LEGAL_UPDATED_AT} otherHref="/conditions-utilisation" otherLabel="Conditions générales d'utilisation">
      <p style={{ marginBottom: 24 }}>
        My ABED est la plateforme de gestion des opérations d'ABED-ONG (missions, ressources humaines, contrats,
        projets, présence des visiteurs...). Cette politique explique quelles données personnelles nous traitons
        dans le cadre de cette plateforme, pourquoi, avec qui elles peuvent être partagées, et quels sont vos droits.
      </p>

      <Toc items={POLITIQUE_TOC} />

      <PolitiqueBody />
    </LegalPageLayout>
  )
}
