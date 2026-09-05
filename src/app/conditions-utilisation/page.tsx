import LegalPageLayout, { Section, Toc } from '@/components/LegalPageLayout'

export const metadata = { title: "Conditions d'utilisation — My ABED" }

const TOC = [
  { id: 'objet', label: '1. Objet et champ d\'application' },
  { id: 'definitions', label: '2. Définitions' },
  { id: 'acces', label: '3. Accès et comptes' },
  { id: 'fonctionnalites', label: '4. Fonctionnalités de la plateforme' },
  { id: 'signature', label: '5. Signature électronique' },
  { id: 'obligations', label: '6. Obligations de l\'utilisateur' },
  { id: 'donnees', label: '7. Données personnelles' },
  { id: 'propriete', label: '8. Propriété intellectuelle' },
  { id: 'disponibilite', label: '9. Disponibilité et responsabilité' },
  { id: 'suspension', label: '10. Suspension et fin d\'accès' },
  { id: 'modifications', label: '11. Modification des présentes conditions' },
  { id: 'droit', label: '12. Droit applicable et litiges' },
  { id: 'contact', label: '13. Contact' },
]

export default function ConditionsUtilisationPage() {
  return (
    <LegalPageLayout title="Conditions générales d'utilisation" updatedAt="3 septembre 2026" otherHref="/politique-confidentialite" otherLabel="Politique de confidentialité">
      <p style={{ marginBottom: 24 }}>
        Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'usage de My ABED, la
        plateforme numérique de gestion des opérations d'Agriculture pour le Bien Être et le Développement Durable
        (ABED-ONG). En accédant à My ABED, vous acceptez les présentes conditions.
      </p>

      <Toc items={TOC} />

      <Section id="objet" title="1. Objet et champ d'application">
        <p>
          My ABED permet au personnel d'ABED-ONG et aux personnes qu'elle sollicite (partenaires, prestataires,
          bénéficiaires de documents) de gérer et de consulter des documents et démarches administratives : ordres
          de mission, congés, feuilles de temps, demandes de paiement, contrats et documents RH, évaluations,
          projets, termes de référence, signatures électroniques, et l'enregistrement de présence des visiteurs.
        </p>
        <p>
          Ces CGU s'appliquent à toute personne accédant à My ABED, qu'elle dispose d'un compte (« Utilisateur »)
          ou qu'elle y accède ponctuellement via un lien sécurisé sans compte (« Signataire externe » ou « Visiteur »).
        </p>
      </Section>

      <Section id="definitions" title="2. Définitions">
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Plateforme</strong> : l'application My ABED, accessible à my.abedong.org.</li>
          <li><strong>Éditeur</strong> : ABED-ONG, association basée à Parakou, Quartier Zongo, Bénin.</li>
          <li><strong>Utilisateur</strong> : toute personne disposant d'un compte My ABED (personnel salarié, stagiaire, bénévole, consultant, prestataire...).</li>
          <li><strong>Signataire externe</strong> : personne invitée à consulter, commenter ou signer un document (contrat, ordre de mission) via un lien personnel et temporaire, sans créer de compte.</li>
          <li><strong>Visiteur</strong> : personne qui s'enregistre via le formulaire public de présence à l'accueil d'ABED-ONG.</li>
        </ul>
      </Section>

      <Section id="acces" title="3. Accès et comptes">
        <p>
          La création d'un compte Utilisateur est réservée au personnel et collaborateurs d'ABED-ONG et est
          effectuée ou validée par le service RH ou l'administration système. Chaque compte est personnel,
          nominatif et non transférable ; l'Utilisateur est responsable de la confidentialité de ses identifiants
          et de toute action réalisée depuis son compte.
        </p>
        <p>
          L'Utilisateur s'engage à informer sans délai l'administration en cas de perte, de vol ou de suspicion
          d'usage non autorisé de son compte.
        </p>
        <p>
          L'accès des Signataires externes et des Visiteurs est limité, respectivement, au document qui leur est
          destiné et au formulaire de présence, sans droit d'accès au reste de la Plateforme.
        </p>
      </Section>

      <Section id="fonctionnalites" title="4. Fonctionnalités de la plateforme">
        <p>Selon son rôle, un Utilisateur peut notamment : soumettre et suivre des ordres de mission, des demandes
          de congé, des feuilles de temps et des demandes de paiement ; consulter et signer des documents RH
          (offres, contrats, conventions, avenants) ; participer à des circuits d'évaluation ; gérer des projets,
          activités et termes de référence ; et, pour le personnel habilité, administrer les comptes, rôles et
          paramètres de la Plateforme, y compris le module de présence des visiteurs.
        </p>
        <p>
          ABED-ONG peut faire évoluer, ajouter ou retirer des fonctionnalités à tout moment, notamment pour des
          raisons de sécurité, de maintenance ou d'amélioration du service.
        </p>
      </Section>

      <Section id="signature" title="5. Signature électronique">
        <p>
          My ABED permet de signer électroniquement certains documents (contrats, ordres de mission, évaluations).
          En apposant sa signature électronique sur la Plateforme, l'Utilisateur ou le Signataire externe reconnaît
          son identité et manifeste son consentement au contenu du document, au même titre qu'une signature
          manuscrite. Chaque signature est horodatée et associée au document concerné.
        </p>
      </Section>

      <Section id="obligations" title="6. Obligations de l'utilisateur">
        <p>L'Utilisateur, le Signataire externe et le Visiteur s'engagent à :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>fournir des informations exactes et à jour ;</li>
          <li>utiliser la Plateforme conformément à sa destination et aux besoins réels d'ABED-ONG ;</li>
          <li>ne pas tenter de contourner les mesures de sécurité, d'accéder à des données ne les concernant pas, ou de perturber le fonctionnement de la Plateforme ;</li>
          <li>ne pas partager ses identifiants ni les liens d'accès personnels qui leur sont envoyés.</li>
        </ul>
      </Section>

      <Section id="donnees" title="7. Données personnelles">
        <p>
          Le traitement des données personnelles collectées via My ABED est décrit dans la{' '}
          <a href="/politique-confidentialite" style={{ color: '#1f7a1f', fontWeight: 700 }}>Politique de confidentialité</a>,
          qui fait partie intégrante des présentes conditions.
        </p>
      </Section>

      <Section id="propriete" title="8. Propriété intellectuelle">
        <p>
          La Plateforme, sa structure, son design et les éléments qui la composent (à l'exclusion des documents
          et données propres à chaque Utilisateur) sont la propriété d'ABED-ONG ou de ses prestataires techniques.
          Toute reproduction ou usage en dehors du cadre professionnel prévu est interdit sans autorisation.
        </p>
      </Section>

      <Section id="disponibilite" title="9. Disponibilité et responsabilité">
        <p>
          ABED-ONG s'efforce d'assurer un accès continu à la Plateforme, sans garantir une disponibilité
          ininterrompue : des interruptions peuvent survenir pour maintenance, mise à jour, ou pour des causes
          échappant à son contrôle (panne d'un prestataire technique, incident réseau...).
        </p>
        <p>
          ABED-ONG ne saurait être tenue responsable des dommages résultant d'une utilisation non conforme de la
          Plateforme, d'informations inexactes fournies par un Utilisateur, ou d'un incident indépendant de sa
          volonté.
        </p>
      </Section>

      <Section id="suspension" title="10. Suspension et fin d'accès">
        <p>
          En cas de fin de la relation entre une personne et ABED-ONG (fin de contrat, de stage, de mission...),
          son compte est désactivé ; l'historique des documents et démarches est conservé conformément à la
          Politique de confidentialité. ABED-ONG peut également suspendre un compte en cas de manquement aux
          présentes CGU ou de risque avéré pour la sécurité de la Plateforme.
        </p>
      </Section>

      <Section id="modifications" title="11. Modification des présentes conditions">
        <p>
          ABED-ONG peut modifier les présentes CGU, notamment pour tenir compte de l'évolution de la Plateforme
          ou de la réglementation applicable. La date de dernière mise à jour figure en haut de cette page ; les
          Utilisateurs seront informés de toute modification substantielle.
        </p>
      </Section>

      <Section id="droit" title="12. Droit applicable et litiges">
        <p>
          Les présentes CGU sont soumises au droit béninois. Tout litige relatif à leur interprétation ou à leur
          exécution sera, à défaut de résolution amiable, porté devant les juridictions compétentes du Bénin.
        </p>
      </Section>

      <Section id="contact" title="13. Contact">
        <p>
          ABED-ONG · Parakou, Quartier Zongo, Bénin
          <br />Email : <strong>contact@abedong.org</strong> · Tél. +229 01 67 77 91 41
        </p>
      </Section>

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 32, paddingTop: 16, borderTop: '1px dashed #e5e7eb' }}>
        Ce document décrit fidèlement le fonctionnement réel de My ABED au moment de sa rédaction. Il est
        recommandé de le faire valider par un conseil juridique compétent en droit béninois avant de le considérer
        comme définitif.
      </p>
    </LegalPageLayout>
  )
}
