// Contenu partagé des deux documents légaux (CGU, politique de
// confidentialité) — utilisé à la fois par les pages publiques
// (/conditions-utilisation, /politique-confidentialite) et par la fenêtre
// de consentement obligatoire (LegalConsentGate), pour n'écrire ce texte
// qu'une seule fois.
//
// LEGAL_VERSION identifie la version en vigueur des deux documents : toute
// modification substantielle de leur contenu doit s'accompagner d'un
// changement de cette valeur, ce qui invalide automatiquement les
// acceptations déjà enregistrées (profiles.conditions_acceptees_version) et
// redéclenche la fenêtre de consentement pour tous les comptes existants.
export const LEGAL_VERSION = '2026-09-05'
export const LEGAL_UPDATED_AT = '5 septembre 2026'

import { Section, SubSection } from '@/components/LegalPageLayout'

export const CGU_TOC = [
  { id: 'objet', label: "1. Objet et champ d'application" },
  { id: 'objet-1', label: '1.1 Objet', sub: true },
  { id: 'objet-2', label: "1.2 Champ d'application", sub: true },
  { id: 'objet-3', label: '1.3 Acceptation', sub: true },
  { id: 'definitions', label: '2. Définitions' },
  { id: 'acces', label: '3. Création de compte et accès' },
  { id: 'acces-1', label: '3.1 Qui peut avoir un compte', sub: true },
  { id: 'acces-2', label: '3.2 Procédure de création', sub: true },
  { id: 'acces-3', label: '3.3 Identifiants et confidentialité', sub: true },
  { id: 'acces-4', label: '3.4 Accès des signataires externes', sub: true },
  { id: 'acces-5', label: '3.5 Accès des visiteurs', sub: true },
  { id: 'fonctionnalites', label: '4. Fonctionnalités de la plateforme' },
  { id: 'fonct-1', label: '4.1 Missions et ordres de mission', sub: true },
  { id: 'fonct-2', label: '4.2 Congés', sub: true },
  { id: 'fonct-3', label: '4.3 Feuilles de temps et rapports', sub: true },
  { id: 'fonct-4', label: '4.4 Demandes de paiement', sub: true },
  { id: 'fonct-5', label: '4.5 Documents RH et contrats', sub: true },
  { id: 'fonct-6', label: '4.6 Évaluations du personnel', sub: true },
  { id: 'fonct-7', label: '4.7 Projets, activités et TdR', sub: true },
  { id: 'fonct-8', label: '4.8 Signatures électroniques', sub: true },
  { id: 'fonct-9', label: '4.9 Présence des visiteurs', sub: true },
  { id: 'fonct-10', label: '4.10 Notifications et journal', sub: true },
  { id: 'signature', label: '5. Signature électronique' },
  { id: 'signature-1', label: '5.1 Valeur juridique', sub: true },
  { id: 'signature-2', label: '5.2 Modalités techniques', sub: true },
  { id: 'signature-3', label: '5.3 Conservation de la preuve', sub: true },
  { id: 'obligations', label: "6. Obligations de l'utilisateur" },
  { id: 'obligations-1', label: '6.1 Exactitude des informations', sub: true },
  { id: 'obligations-2', label: '6.2 Usage conforme', sub: true },
  { id: 'obligations-3', label: '6.3 Sécurité des accès', sub: true },
  { id: 'obligations-4', label: '6.4 Comportements interdits', sub: true },
  { id: 'donnees', label: '7. Données personnelles' },
  { id: 'propriete', label: '8. Propriété intellectuelle' },
  { id: 'propriete-1', label: '8.1 Éléments protégés', sub: true },
  { id: 'propriete-2', label: "8.2 Contenus de l'utilisateur", sub: true },
  { id: 'disponibilite', label: '9. Disponibilité et responsabilité' },
  { id: 'dispo-1', label: '9.1 Disponibilité', sub: true },
  { id: 'dispo-2', label: '9.2 Limitation de responsabilité', sub: true },
  { id: 'dispo-3', label: '9.3 Force majeure', sub: true },
  { id: 'suspension', label: "10. Suspension et fin d'accès" },
  { id: 'suspension-1', label: "10.1 Départ d'un agent", sub: true },
  { id: 'suspension-2', label: '10.2 Suspension pour manquement', sub: true },
  { id: 'suspension-3', label: '10.3 Conservation après désactivation', sub: true },
  { id: 'acceptation', label: '11. Acceptation et mise à jour des CGU' },
  { id: 'acceptation-1', label: '11.1 Acceptation obligatoire', sub: true },
  { id: 'acceptation-2', label: '11.2 Révision des CGU', sub: true },
  { id: 'acceptation-3', label: '11.3 Effet du refus', sub: true },
  { id: 'droit', label: '12. Droit applicable et litiges' },
  { id: 'contact', label: '13. Contact' },
]

export function CguBody() {
  return (
    <>
      <Section id="objet" title="1. Objet et champ d'application">
        <SubSection id="objet-1" title="1.1 Objet">
          <p>
            Les présentes conditions générales d'utilisation (« CGU ») ont pour objet de définir les modalités et
            conditions dans lesquelles Agriculture pour le Bien Être et le Développement Durable (« ABED-ONG »,
            « nous », « l'Éditeur ») met à disposition sa plateforme numérique de gestion des opérations, dénommée
            My ABED (« la Plateforme »), ainsi que les droits et obligations des personnes qui y accèdent.
          </p>
        </SubSection>
        <SubSection id="objet-2" title="1.2 Champ d'application">
          <p>
            Les présentes CGU s'appliquent, sans restriction ni réserve, à l'ensemble des personnes accédant à la
            Plateforme, quel que soit leur mode d'accès : membres du personnel disposant d'un compte permanent
            (« Utilisateurs »), personnes invitées à consulter ou signer un document précis sans créer de compte
            (« Signataires externes »), et personnes s'enregistrant via le formulaire public de présence des
            visiteurs (« Visiteurs »). Elles s'appliquent également à l'ensemble des fonctionnalités actuelles et
            futures de la Plateforme.
          </p>
        </SubSection>
        <SubSection id="objet-3" title="1.3 Acceptation">
          <p>
            L'accès et l'usage de la Plateforme impliquent l'acceptation pleine et entière des présentes CGU. Pour
            les Utilisateurs disposant d'un compte, cette acceptation est recueillie explicitement lors de la
            première connexion suivant la création du compte, puis à nouveau à chaque mise à jour substantielle
            des présentes CGU, selon les modalités décrites à l'article 11. Le fait de continuer à utiliser la
            Plateforme après une telle mise à jour vaut également acceptation des CGU révisées.
          </p>
        </SubSection>
      </Section>

      <Section id="definitions" title="2. Définitions">
        <p>Pour les besoins des présentes CGU, les termes suivants ont la signification qui leur est donnée ci-dessous :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Plateforme</strong> : l'application web My ABED, accessible à l'adresse my.abedong.org, ainsi que l'ensemble de ses composants (interface, base de données, documents générés).</li>
          <li><strong>Éditeur</strong> : ABED-ONG, association de droit béninois immatriculée sous le n° 2019-4/0008/PDB/SG/SAG, dont le siège est à Parakou, Quartier Zongo, Bénin.</li>
          <li><strong>Utilisateur</strong> : toute personne physique disposant d'un compte personnel sur la Plateforme, quel que soit son statut (personnel salarié, stagiaire, bénévole, consultant, prestataire) ou son rôle (agent, responsable RH, direction, administrateur système...).</li>
          <li><strong>Signataire externe</strong> : personne invitée, sans créer de compte, à consulter, commenter ou signer électroniquement un document (contrat, ordre de mission) via un lien personnel et temporaire transmis par email.</li>
          <li><strong>Visiteur</strong> : personne physique qui, sans créer de compte, renseigne le formulaire public d'enregistrement de présence mis à disposition à l'accueil des locaux d'ABED-ONG (lien ou QR code).</li>
          <li><strong>Compte</strong> : l'espace personnel et sécurisé attribué à un Utilisateur, associé à des identifiants de connexion propres et à un ou plusieurs rôles définissant ses droits d'accès.</li>
          <li><strong>Document</strong> : tout contenu créé, transmis ou signé via la Plateforme (contrat, ordre de mission, évaluation, feuille de temps, demande de congé ou de paiement, terme de référence...).</li>
        </ul>
      </Section>

      <Section id="acces" title="3. Création de compte et accès">
        <SubSection id="acces-1" title="3.1 Qui peut avoir un compte">
          <p>
            La création d'un Compte est réservée aux personnes ayant une relation professionnelle ou de
            collaboration avec ABED-ONG : personnel salarié, stagiaires, bénévoles, consultants et prestataires
            appelés à intervenir régulièrement pour le compte de l'organisation.
          </p>
        </SubSection>
        <SubSection id="acces-2" title="3.2 Procédure de création">
          <p>
            Un Compte est créé ou validé par le service des ressources humaines ou par l'administration système
            de la Plateforme, généralement à l'occasion de l'arrivée de la personne concernée au sein d'ABED-ONG.
            L'Utilisateur peut être invité à compléter ou corriger certaines informations de son profil lors de
            sa première connexion.
          </p>
        </SubSection>
        <SubSection id="acces-3" title="3.3 Identifiants et confidentialité">
          <p>
            Chaque Compte est strictement personnel, nominatif et non transférable. L'Utilisateur est seul
            responsable de la confidentialité de ses identifiants (adresse email et mot de passe) et de toute
            action effectuée depuis son Compte, y compris par un tiers auquel il aurait, volontairement ou non,
            donné accès à ses identifiants. Il s'engage à informer sans délai ABED-ONG en cas de perte, de vol,
            ou de toute suspicion d'usage non autorisé de son Compte.
          </p>
        </SubSection>
        <SubSection id="acces-4" title="3.4 Accès des signataires externes">
          <p>
            Les Signataires externes accèdent à un Document déterminé via un lien personnel, signé
            cryptographiquement et limité dans le temps (généralement 72 heures), transmis à l'adresse email
            renseignée par ABED-ONG. Ce lien ne donne accès qu'au Document concerné, à l'exclusion de toute autre
            fonctionnalité ou donnée de la Plateforme. Le Signataire externe est responsable de la confidentialité
            de ce lien et ne doit pas le transmettre à un tiers.
          </p>
        </SubSection>
        <SubSection id="acces-5" title="3.5 Accès des visiteurs">
          <p>
            Les Visiteurs accèdent uniquement au formulaire public d'enregistrement de présence, sans droit
            d'accès à aucune autre partie de la Plateforme. Le renseignement de ce formulaire est volontaire.
          </p>
        </SubSection>
      </Section>

      <Section id="fonctionnalites" title="4. Fonctionnalités de la plateforme">
        <p>Selon son rôle, un Utilisateur peut accéder tout ou partie des modules suivants, dont la liste peut évoluer :</p>
        <SubSection id="fonct-1" title="4.1 Missions et ordres de mission">
          <p>Création, suivi et signature des ordres de mission, y compris pour des missionnaires ne disposant pas d'un Compte.</p>
        </SubSection>
        <SubSection id="fonct-2" title="4.2 Congés">
          <p>Soumission, validation et suivi des demandes de congé, ainsi que la consultation des soldes correspondants.</p>
        </SubSection>
        <SubSection id="fonct-3" title="4.3 Feuilles de temps et rapports">
          <p>Déclaration du temps de travail et établissement des rapports mensuels d'activité.</p>
        </SubSection>
        <SubSection id="fonct-4" title="4.4 Demandes de paiement">
          <p>Soumission et suivi des demandes de paiement liées aux missions, prestations ou remboursements.</p>
        </SubSection>
        <SubSection id="fonct-5" title="4.5 Documents RH et contrats">
          <p>Établissement, circuit de signature et archivage des offres, contrats, conventions et avenants, y compris à destination de personnes sans Compte My ABED.</p>
        </SubSection>
        <SubSection id="fonct-6" title="4.6 Évaluations du personnel">
          <p>Conduite des circuits d'évaluation périodique, avec les décisions et signatures des personnes habilitées.</p>
        </SubSection>
        <SubSection id="fonct-7" title="4.7 Projets, activités et TdR">
          <p>Gestion des projets internes, de leurs activités, et suivi financier des termes de référence (TdR).</p>
        </SubSection>
        <SubSection id="fonct-8" title="4.8 Signatures électroniques">
          <p>Module transversal de circuits de signature applicable à différents types de documents.</p>
        </SubSection>
        <SubSection id="fonct-9" title="4.9 Présence des visiteurs">
          <p>Enregistrement de la présence des Visiteurs à l'accueil, via un lien ou un QR code public.</p>
        </SubSection>
        <SubSection id="fonct-10" title="4.10 Notifications et journal">
          <p>Notifications internes et par email relatives à l'activité de l'Utilisateur, et journal d'audit des connexions et actions sensibles, à des fins de sécurité et de traçabilité.</p>
        </SubSection>
        <p>
          ABED-ONG se réserve le droit de faire évoluer, d'ajouter ou de retirer des fonctionnalités à tout
          moment, notamment pour des raisons de sécurité, de maintenance, de conformité réglementaire ou
          d'amélioration du service, sans que cela ne puisse engager sa responsabilité.
        </p>
      </Section>

      <Section id="signature" title="5. Signature électronique">
        <SubSection id="signature-1" title="5.1 Valeur juridique">
          <p>
            My ABED permet à un Utilisateur ou un Signataire externe d'apposer une signature électronique sur
            certains Documents (contrats, ordres de mission, évaluations). En apposant sa signature électronique,
            la personne reconnaît son identité, manifeste son consentement au contenu du Document et accepte que
            cette signature électronique produise, entre les parties, les mêmes effets qu'une signature manuscrite.
          </p>
        </SubSection>
        <SubSection id="signature-2" title="5.2 Modalités techniques">
          <p>
            Chaque signature électronique est associée à l'identité déclarée du signataire, horodatée au moment de
            sa réalisation, et liée de façon indissociable au Document signé. Un Document ne peut plus être
            modifié après signature sans invalider la signature ou déclencher un nouveau circuit de signature,
            selon le cas.
          </p>
        </SubSection>
        <SubSection id="signature-3" title="5.3 Conservation de la preuve">
          <p>
            ABED-ONG conserve, pour chaque Document signé, les éléments permettant d'en établir la preuve
            (identité du signataire, horodatage, contenu du Document au moment de la signature), pendant la durée
            de conservation applicable décrite dans la Politique de confidentialité.
          </p>
        </SubSection>
      </Section>

      <Section id="obligations" title="6. Obligations de l'utilisateur">
        <SubSection id="obligations-1" title="6.1 Exactitude des informations">
          <p>L'Utilisateur, le Signataire externe et le Visiteur s'engagent à fournir des informations exactes, complètes et à jour, et à les corriger sans délai en cas de changement.</p>
        </SubSection>
        <SubSection id="obligations-2" title="6.2 Usage conforme">
          <p>La Plateforme doit être utilisée conformément à sa destination professionnelle et aux besoins réels d'ABED-ONG. Tout usage à des fins personnelles, commerciales ou étrangères à l'activité d'ABED-ONG est interdit.</p>
        </SubSection>
        <SubSection id="obligations-3" title="6.3 Sécurité des accès">
          <p>L'Utilisateur ne doit partager ni ses identifiants, ni les liens d'accès personnels qui lui sont transmis (Signataire externe), et doit se déconnecter de la Plateforme lorsqu'il utilise un appareil partagé.</p>
        </SubSection>
        <SubSection id="obligations-4" title="6.4 Comportements interdits">
          <p>Sont notamment interdits : toute tentative de contournement des mesures de sécurité ; tout accès ou toute tentative d'accès à des données ne concernant pas l'Utilisateur ; toute action visant à perturber, surcharger ou endommager le fonctionnement de la Plateforme ; toute utilisation frauduleuse de l'identité d'un tiers ; et toute extraction massive de données non autorisée.</p>
        </SubSection>
      </Section>

      <Section id="donnees" title="7. Données personnelles">
        <p>
          Les modalités de collecte, de traitement et de conservation des données personnelles des Utilisateurs,
          Signataires externes et Visiteurs sont décrites dans la{' '}
          <a href="/politique-confidentialite" style={{ color: '#1f7a1f', fontWeight: 700 }}>Politique de confidentialité et de protection des données</a>,
          qui fait partie intégrante des présentes CGU et doit être lue et acceptée conjointement à celles-ci.
        </p>
      </Section>

      <Section id="propriete" title="8. Propriété intellectuelle">
        <SubSection id="propriete-1" title="8.1 Éléments protégés">
          <p>
            La Plateforme, son architecture, son interface graphique, son code source, ses logos et sa marque
            « My ABED » sont la propriété exclusive d'ABED-ONG ou de ses prestataires techniques. Toute
            reproduction, représentation, modification ou exploitation de tout ou partie de ces éléments, en
            dehors de l'usage professionnel prévu par les présentes CGU, est interdite sans autorisation écrite
            préalable.
          </p>
        </SubSection>
        <SubSection id="propriete-2" title="8.2 Contenus de l'utilisateur">
          <p>
            Les Documents et données propres à chaque Utilisateur (contrats, missions, évaluations...) demeurent
            sa propriété ou celle d'ABED-ONG selon leur nature, sans préjudice du droit d'ABED-ONG de les
            conserver, traiter et archiver conformément aux présentes CGU et à la Politique de confidentialité.
          </p>
        </SubSection>
      </Section>

      <Section id="disponibilite" title="9. Disponibilité et responsabilité">
        <SubSection id="dispo-1" title="9.1 Disponibilité">
          <p>
            ABED-ONG s'efforce d'assurer un accès continu à la Plateforme mais ne garantit pas une disponibilité
            ininterrompue. Des interruptions peuvent survenir pour des opérations de maintenance planifiée ou
            non planifiée, de mise à jour, ou pour des raisons échappant à son contrôle.
          </p>
        </SubSection>
        <SubSection id="dispo-2" title="9.2 Limitation de responsabilité">
          <p>
            ABED-ONG ne saurait être tenue responsable des dommages directs ou indirects résultant : d'une
            utilisation non conforme de la Plateforme par un Utilisateur, d'informations inexactes ou incomplètes
            fournies par un Utilisateur, d'un incident affectant un prestataire technique tiers, ou d'un cas de
            force majeure.
          </p>
        </SubSection>
        <SubSection id="dispo-3" title="9.3 Force majeure">
          <p>
            Aucune des parties ne pourra être tenue responsable de l'inexécution de ses obligations résultant d'un
            événement de force majeure au sens du droit béninois.
          </p>
        </SubSection>
      </Section>

      <Section id="suspension" title="10. Suspension et fin d'accès">
        <SubSection id="suspension-1" title="10.1 Départ d'un agent">
          <p>
            En cas de fin de la relation entre une personne et ABED-ONG (fin de contrat, de stage, de mission,
            démission ou rupture), son Compte est désactivé. La désactivation empêche toute nouvelle connexion
            mais ne supprime pas l'historique des Documents et démarches associés à ce Compte.
          </p>
        </SubSection>
        <SubSection id="suspension-2" title="10.2 Suspension pour manquement">
          <p>
            ABED-ONG peut suspendre ou désactiver un Compte, avec ou sans préavis selon la gravité de la
            situation, en cas de manquement aux présentes CGU, d'usage frauduleux constaté, ou de risque avéré
            pour la sécurité de la Plateforme ou des données d'autrui.
          </p>
        </SubSection>
        <SubSection id="suspension-3" title="10.3 Conservation après désactivation">
          <p>
            Les données et Documents associés à un Compte désactivé sont conservés conformément aux durées
            décrites dans la Politique de confidentialité, notamment pour satisfaire aux obligations légales,
            sociales, comptables et fiscales applicables à ABED-ONG.
          </p>
        </SubSection>
      </Section>

      <Section id="acceptation" title="11. Acceptation et mise à jour des CGU">
        <SubSection id="acceptation-1" title="11.1 Acceptation obligatoire">
          <p>
            L'accès aux fonctionnalités de la Plateforme réservées aux Utilisateurs est conditionné à la lecture
            complète et à l'acceptation expresse des présentes CGU ainsi que de la Politique de confidentialité.
            Cette acceptation est recueillie via une fenêtre dédiée qui impose de parcourir l'intégralité des deux
            documents avant de pouvoir cliquer sur « J'accepte ».
          </p>
        </SubSection>
        <SubSection id="acceptation-2" title="11.2 Révision des CGU">
          <p>
            ABED-ONG peut réviser les présentes CGU à tout moment, notamment pour tenir compte de l'évolution de
            la Plateforme, de ses pratiques, ou de la réglementation applicable. Toute révision substantielle
            entraîne une nouvelle demande d'acceptation, présentée à chaque Utilisateur concerné lors de sa
            prochaine connexion, qui doit à nouveau parcourir et accepter les documents mis à jour avant de
            pouvoir continuer à utiliser la Plateforme.
          </p>
        </SubSection>
        <SubSection id="acceptation-3" title="11.3 Effet du refus">
          <p>
            Un Utilisateur qui refuse d'accepter les CGU révisées ne peut pas continuer à accéder aux
            fonctionnalités de la Plateforme réservées aux Utilisateurs. Il conserve la possibilité de se
            déconnecter et de solliciter le service RH ou l'administration système d'ABED-ONG pour toute question
            relative à ce refus.
          </p>
        </SubSection>
      </Section>

      <Section id="droit" title="12. Droit applicable et litiges">
        <p>
          Les présentes CGU sont soumises au droit de la République du Bénin. En cas de différend relatif à leur
          validité, leur interprétation ou leur exécution, les parties s'efforceront de trouver une solution
          amiable ; à défaut, le litige sera porté devant les juridictions compétentes du Bénin.
        </p>
      </Section>

      <Section id="contact" title="13. Contact">
        <p>
          ABED-ONG · Parakou, Quartier Zongo, Bénin
          <br />Email : <strong>contact@abedong.org</strong> · Tél. +229 01 67 77 91 41
        </p>
      </Section>
    </>
  )
}

export const POLITIQUE_TOC = [
  { id: 'preambule', label: '1. Préambule' },
  { id: 'responsable', label: '2. Responsable du traitement' },
  { id: 'cadre-legal', label: '3. Cadre légal' },
  { id: 'cadre-legal-1', label: '3.1 Loi applicable', sub: true },
  { id: 'cadre-legal-2', label: '3.2 Autorité de contrôle', sub: true },
  { id: 'personnes', label: '4. Personnes concernées' },
  { id: 'personnes-1', label: '4.1 Personnel', sub: true },
  { id: 'personnes-2', label: '4.2 Signataires externes', sub: true },
  { id: 'personnes-3', label: '4.3 Visiteurs', sub: true },
  { id: 'donnees', label: '5. Données collectées' },
  { id: 'donnees-1', label: "5.1 Identité et contact", sub: true },
  { id: 'donnees-2', label: '5.2 Données professionnelles', sub: true },
  { id: 'donnees-3', label: '5.3 Rémunération', sub: true },
  { id: 'donnees-4', label: "5.4 Données d'activité", sub: true },
  { id: 'donnees-5', label: '5.5 Signature électronique', sub: true },
  { id: 'donnees-6', label: '5.6 Sécurité et connexion', sub: true },
  { id: 'donnees-7', label: '5.7 Géolocalisation au bureau', sub: true },
  { id: 'donnees-8', label: '5.8 Signataires externes', sub: true },
  { id: 'donnees-9', label: '5.9 Visiteurs', sub: true },
  { id: 'finalites', label: '6. Finalités et bases légales' },
  { id: 'finalites-1', label: '6.1 Gestion administrative et RH', sub: true },
  { id: 'finalites-2', label: '6.2 Conclusion et suivi des documents', sub: true },
  { id: 'finalites-3', label: '6.3 Contrôle de présence au bureau', sub: true },
  { id: 'finalites-4', label: '6.4 Sécurité du système', sub: true },
  { id: 'finalites-5', label: '6.5 Gestion des visites', sub: true },
  { id: 'destinataires', label: '7. Destinataires et sous-traitants' },
  { id: 'transferts', label: '8. Hébergement et transferts de données' },
  { id: 'conservation', label: '9. Durées de conservation' },
  { id: 'conservation-1', label: '9.1 Comptes et dossiers RH', sub: true },
  { id: 'conservation-2', label: '9.2 Géolocalisation', sub: true },
  { id: 'conservation-3', label: '9.3 Visiteurs', sub: true },
  { id: 'conservation-4', label: '9.4 Journaux de connexion', sub: true },
  { id: 'securite', label: '10. Sécurité des données' },
  { id: 'droits', label: '11. Vos droits' },
  { id: 'droits-1', label: "11.1 Droit d'accès", sub: true },
  { id: 'droits-2', label: '11.2 Droit de rectification', sub: true },
  { id: 'droits-3', label: "11.3 Droit d'opposition", sub: true },
  { id: 'droits-4', label: "11.4 Droit à l'effacement", sub: true },
  { id: 'droits-5', label: '11.5 Droit à la limitation', sub: true },
  { id: 'droits-6', label: "11.6 Modalités d'exercice", sub: true },
  { id: 'cookies', label: '12. Cookies et traceurs' },
  { id: 'acceptation', label: '13. Acceptation et mise à jour' },
  { id: 'contact', label: '14. Contact et réclamations' },
]

export function PolitiqueBody() {
  return (
    <>
      <Section id="preambule" title="1. Préambule">
        <p>
          My ABED est la plateforme numérique de gestion des opérations d'ABED-ONG. Elle traite, à ce titre, des
          données à caractère personnel relatives à son personnel, aux personnes qui signent des documents sans
          disposer d'un compte, et aux visiteurs de ses locaux. La présente politique explique quelles données
          sont collectées, pourquoi, pendant combien de temps, avec qui elles peuvent être partagées, et quels
          droits vous pouvez exercer.
        </p>
      </Section>

      <Section id="responsable" title="2. Responsable du traitement">
        <p>Le responsable du traitement des données personnelles décrites dans cette politique est :</p>
        <p style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', margin: '10px 0' }}>
          <strong>Agriculture pour le Bien Être et le Développement Durable (ABED-ONG)</strong><br />
          N° 2019-4/0008/PDB/SG/SAG du 16 janvier 2019 ; J.OFF du 15 juin 2022<br />
          Parakou, Quartier Zongo, République du Bénin<br />
          Tél. +229 01 67 77 91 41 · Email : contact@abedong.org
        </p>
      </Section>

      <Section id="cadre-legal" title="3. Cadre légal">
        <SubSection id="cadre-legal-1" title="3.1 Loi applicable">
          <p>
            Ce traitement s'inscrit dans le cadre de la loi n° 2017-20 du 20 avril 2018 portant Code du numérique
            en République du Bénin, dont le titre relatif à la protection des données à caractère personnel
            encadre la collecte, le traitement et la conservation de ce type de données. ABED-ONG s'engage à
            respecter les principes de licéité, de finalité déterminée, de minimisation, d'exactitude, de
            limitation de la conservation et de sécurité posés par ce cadre.
          </p>
        </SubSection>
        <SubSection id="cadre-legal-2" title="3.2 Autorité de contrôle">
          <p>
            L'autorité compétente pour le contrôle de l'application de cette réglementation au Bénin est
            l'Autorité de Protection des Données à caractère Personnel (APDP).
          </p>
        </SubSection>
      </Section>

      <Section id="personnes" title="4. Personnes concernées">
        <SubSection id="personnes-1" title="4.1 Personnel">
          <p>Toute personne disposant d'un compte My ABED : personnel salarié, stagiaires, bénévoles, consultants et prestataires.</p>
        </SubSection>
        <SubSection id="personnes-2" title="4.2 Signataires externes">
          <p>Toute personne invitée à consulter ou signer un contrat ou un ordre de mission via un lien sécurisé, sans créer de compte.</p>
        </SubSection>
        <SubSection id="personnes-3" title="4.3 Visiteurs">
          <p>Toute personne s'enregistrant via le formulaire public de présence à l'accueil d'ABED-ONG.</p>
        </SubSection>
      </Section>

      <Section id="donnees" title="5. Données collectées">
        <SubSection id="donnees-1" title="5.1 Identité et contact">
          <p>Civilité, nom, prénoms, adresse email, numéro de téléphone, adresse postale, photo de profil.</p>
        </SubSection>
        <SubSection id="donnees-2" title="5.2 Données professionnelles">
          <p>Rôle, fonction, direction de rattachement, type d'emploi, titre/grade, ancienneté, manager direct.</p>
        </SubSection>
        <SubSection id="donnees-3" title="5.3 Rémunération">
          <p>Type de contrat, dates, poste occupé, salaire brut ou taux de rémunération, historique des documents RH (offres, contrats, conventions, avenants) et de leur statut de signature, montants des demandes de paiement.</p>
        </SubSection>
        <SubSection id="donnees-4" title="5.4 Données d'activité">
          <p>Missions et ordres de mission, demandes et soldes de congés, feuilles de temps et rapports mensuels, évaluations de performance, projets, activités et termes de référence auxquels la personne est associée.</p>
        </SubSection>
        <SubSection id="donnees-5" title="5.5 Signature électronique">
          <p>Rendu graphique de la signature, nom déclaré au moment de signer, date et heure de la signature, Document associé.</p>
        </SubSection>
        <SubSection id="donnees-6" title="5.6 Sécurité et connexion">
          <p>Identifiant de connexion, mot de passe (jamais conservé en clair — géré par le système d'authentification), historique des connexions et de la navigation dans l'application (adresse IP, type d'appareil et de navigateur, pages consultées, horodatage), à des fins de sécurité et de traçabilité des accès.</p>
        </SubSection>
        <SubSection id="donnees-7" title="5.7 Géolocalisation au bureau">
          <p>
            Afin de vérifier la présence physique des agents sur leur lieu de travail, My ABED collecte ou pourra
            collecter la position géographique de l'appareil utilisé par l'agent, au moment précis où celui-ci
            effectue un pointage ou une action de vérification de présence depuis les locaux d'ABED-ONG. Cette
            collecte est ponctuelle, limitée au moment du pointage, et n'a pas vocation à assurer un suivi
            continu ou permanent des déplacements de l'agent en dehors de ces instants de vérification. Elle
            n'est pas utilisée à d'autres fins que le contrôle de présence au bureau.
          </p>
        </SubSection>
        <SubSection id="donnees-8" title="5.8 Signataires externes">
          <p>Nom, prénoms et adresse email déclarés pour recevoir le lien de signature, ainsi que la signature électronique et sa date. Les données de connexion et de géolocalisation décrites ci-dessus ne sont pas collectées pour ces personnes.</p>
        </SubSection>
        <SubSection id="donnees-9" title="5.9 Visiteurs">
          <p>Nom, prénom, téléphone, email (facultatif), motif de la visite et réponses aux éventuelles questions complémentaires configurées par ABED-ONG (ex. structure représentée, personne à rencontrer), date et heure de l'enregistrement.</p>
        </SubSection>
      </Section>

      <Section id="finalites" title="6. Finalités et bases légales">
        <SubSection id="finalites-1" title="6.1 Gestion administrative et RH">
          <p>Gestion des contrats, de la paie, des congés, des évaluations et des missions — sur la base de l'exécution du contrat de travail, de la convention ou de l'engagement liant la personne à ABED-ONG, et du respect des obligations légales et comptables applicables.</p>
        </SubSection>
        <SubSection id="finalites-2" title="6.2 Conclusion et suivi des documents">
          <p>Établissement et suivi des contrats et ordres de mission impliquant des tiers — sur la base de l'exécution du Document accepté et signé par la personne concernée.</p>
        </SubSection>
        <SubSection id="finalites-3" title="6.3 Contrôle de présence au bureau">
          <p>Vérification, par géolocalisation ponctuelle décrite à l'article 5.7, de la présence physique des agents sur leur lieu de travail — sur la base de l'intérêt légitime d'ABED-ONG à organiser et contrôler l'exécution du travail, dans le respect du principe de proportionnalité.</p>
        </SubSection>
        <SubSection id="finalites-4" title="6.4 Sécurité du système">
          <p>Journalisation des connexions et actions sensibles, protections anti-robot — sur la base de l'intérêt légitime d'ABED-ONG à sécuriser son système d'information.</p>
        </SubSection>
        <SubSection id="finalites-5" title="6.5 Gestion des visites">
          <p>Enregistrement des Visiteurs à l'accueil — sur la base du consentement donné par la personne au moment où elle remplit volontairement le formulaire de présence.</p>
        </SubSection>
      </Section>

      <Section id="destinataires" title="7. Destinataires et sous-traitants">
        <p>
          Les données sont accessibles, selon leur nature et dans la limite de ce qui est nécessaire à leurs
          fonctions, au personnel RH, à la Direction Exécutive et aux administrateurs habilités de My ABED. Un
          système de rôles et de permissions restreint l'accès de chaque utilisateur aux seules données
          pertinentes pour ses missions.
        </p>
        <p>Certains traitements techniques sont confiés à des prestataires (sous-traitants) agissant sur instruction d'ABED-ONG :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Supabase</strong> — hébergement de la base de données, authentification des comptes et stockage des documents/fichiers ;</li>
          <li><strong>Vercel</strong> — hébergement de l'application web My ABED ;</li>
          <li><strong>Resend</strong> — envoi des emails transactionnels (notifications, liens de signature, invitations).</li>
        </ul>
        <p>Ces prestataires n'utilisent les données que pour fournir le service technique concerné et ne sont pas autorisés à les exploiter à d'autres fins.</p>
      </Section>

      <Section id="transferts" title="8. Hébergement et transferts de données">
        <p>
          Les prestataires mentionnés ci-dessus opèrent une infrastructure cloud internationale, ce qui peut
          conduire à un hébergement des données en dehors du Bénin. ABED-ONG s'assure que ces prestataires
          présentent des garanties appropriées de sécurité et de confidentialité, et recommande la formalisation
          d'accords de traitement des données avec chacun d'eux lorsque ce n'est pas déjà le cas.
        </p>
      </Section>

      <Section id="conservation" title="9. Durées de conservation">
        <p>À titre indicatif, et sous réserve des obligations légales de conservation propres aux documents sociaux, comptables et fiscaux :</p>
        <SubSection id="conservation-1" title="9.1 Comptes et dossiers RH">
          <p>Conservés pendant toute la durée de la relation avec ABED-ONG, puis archivés (et non supprimés) après son terme, afin de conserver l'historique des documents RH et financiers pendant la durée légalement requise.</p>
        </SubSection>
        <SubSection id="conservation-2" title="9.2 Géolocalisation">
          <p>Les données de géolocalisation ponctuelle décrites à l'article 5.7 sont conservées uniquement pour la durée nécessaire au contrôle de présence (à titre indicatif, 12 mois), sans constituer un historique de déplacement à plus long terme.</p>
        </SubSection>
        <SubSection id="conservation-3" title="9.3 Visiteurs">
          <p>Les données des Visiteurs (formulaire de présence) sont conservées 12 mois à compter de la visite.</p>
        </SubSection>
        <SubSection id="conservation-4" title="9.4 Journaux de connexion">
          <p>Le journal de connexion et de navigation est conservé 12 mois à des fins de sécurité, sauf besoin d'investigation particulier.</p>
        </SubSection>
      </Section>

      <Section id="securite" title="10. Sécurité des données">
        <p>ABED-ONG met en œuvre des mesures techniques et organisationnelles pour protéger vos données, notamment :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>connexions chiffrées (HTTPS) entre votre appareil et la plateforme ;</li>
          <li>authentification individuelle et contrôle d'accès par rôle ;</li>
          <li>règles de sécurité au niveau de la base de données limitant l'accès direct aux données ;</li>
          <li>horodatage et traçabilité des signatures électroniques et des actions sensibles ;</li>
          <li>liens d'accès externes limités dans le temps et propres à leur destinataire.</li>
        </ul>
      </Section>

      <Section id="droits" title="11. Vos droits">
        <p>Conformément au Code du numérique béninois, vous disposez, sur les données vous concernant, des droits suivants :</p>
        <SubSection id="droits-1" title="11.1 Droit d'accès">
          <p>Obtenir la confirmation que vos données sont traitées et en recevoir une copie.</p>
        </SubSection>
        <SubSection id="droits-2" title="11.2 Droit de rectification">
          <p>Faire corriger des données inexactes ou incomplètes.</p>
        </SubSection>
        <SubSection id="droits-3" title="11.3 Droit d'opposition">
          <p>Vous opposer, pour motif légitime, à un traitement.</p>
        </SubSection>
        <SubSection id="droits-4" title="11.4 Droit à l'effacement">
          <p>Demander la suppression de vos données, dans la limite des obligations légales de conservation qui s'imposeraient à ABED-ONG.</p>
        </SubSection>
        <SubSection id="droits-5" title="11.5 Droit à la limitation">
          <p>Demander la limitation du traitement dans certains cas prévus par la loi.</p>
        </SubSection>
        <SubSection id="droits-6" title="11.6 Modalités d'exercice">
          <p>
            Pour exercer ces droits, contactez ABED-ONG à <strong>contact@abedong.org</strong>. Une réponse vous
            sera apportée dans un délai raisonnable. Vous pouvez également adresser une réclamation à l'Autorité
            de Protection des Données à caractère Personnel (APDP) du Bénin.
          </p>
        </SubSection>
      </Section>

      <Section id="cookies" title="12. Cookies et traceurs">
        <p>
          My ABED utilise uniquement des cookies strictement nécessaires au fonctionnement du service, en
          particulier pour maintenir votre session de connexion. Aucun cookie publicitaire ou de mesure d'audience
          tiers n'est utilisé.
        </p>
      </Section>

      <Section id="acceptation" title="13. Acceptation et mise à jour">
        <p>
          L'accès aux fonctionnalités réservées aux Utilisateurs est conditionné à la lecture complète et à
          l'acceptation expresse de la présente politique, conjointement aux Conditions générales d'utilisation,
          via la fenêtre de consentement dédiée. Cette politique peut être mise à jour pour refléter l'évolution
          des fonctionnalités de My ABED ou du cadre légal applicable ; toute mise à jour substantielle
          déclenche une nouvelle demande d'acceptation lors de la prochaine connexion des Utilisateurs concernés.
        </p>
      </Section>

      <Section id="contact" title="14. Contact et réclamations">
        <p>
          ABED-ONG · Parakou, Quartier Zongo, Bénin
          <br />Email : <strong>contact@abedong.org</strong> · Tél. +229 01 67 77 91 41
        </p>
      </Section>
    </>
  )
}
