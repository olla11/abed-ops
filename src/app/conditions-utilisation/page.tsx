import LegalPageLayout, { Toc } from '@/components/LegalPageLayout'
import { CguBody, CGU_TOC, LEGAL_UPDATED_AT } from '@/lib/legal-content'

export const metadata = { title: "Conditions d'utilisation — My ABED" }

export default function ConditionsUtilisationPage() {
  return (
    <LegalPageLayout title="Conditions générales d'utilisation" updatedAt={LEGAL_UPDATED_AT} otherHref="/politique-confidentialite" otherLabel="Politique de confidentialité">
      <p style={{ marginBottom: 24 }}>
        Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'usage de My ABED, la
        plateforme numérique de gestion des opérations d'Agriculture pour le Bien Être et le Développement Durable
        (ABED-ONG). En accédant à My ABED, vous acceptez les présentes conditions.
      </p>

      <Toc items={CGU_TOC} />

      <CguBody />
    </LegalPageLayout>
  )
}
