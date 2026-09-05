import LegalPageLayout, { Section, Toc } from '@/components/LegalPageLayout'

export const metadata = { title: 'Politique de confidentialité — My ABED' }

const TOC = [
  { id: 'responsable', label: '1. Responsable du traitement' },
  { id: 'cadre-legal', label: '2. Cadre légal' },
  { id: 'personnes', label: '3. Personnes concernées' },
  { id: 'donnees', label: '4. Données collectées' },
  { id: 'finalites', label: '5. Finalités et bases légales' },
  { id: 'destinataires', label: '6. Destinataires et sous-traitants' },
  { id: 'transferts', label: '7. Hébergement et transferts de données' },
  { id: 'conservation', label: '8. Durées de conservation' },
  { id: 'securite', label: '9. Sécurité des données' },
  { id: 'droits', label: '10. Vos droits' },
  { id: 'cookies', label: '11. Cookies et traceurs' },
  { id: 'modifications', label: '12. Modifications de la politique' },
  { id: 'contact', label: '13. Contact et réclamations' },
]

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalPageLayout title="Politique de confidentialité et de protection des données" updatedAt="3 septembre 2026" otherHref="/conditions-utilisation" otherLabel="Conditions générales d'utilisation">
      <p style={{ marginBottom: 24 }}>
        My ABED est la plateforme de gestion des opérations d'ABED-ONG (missions, ressources humaines, contrats,
        projets, présence des visiteurs...). Cette politique explique quelles données personnelles nous traitons
        dans le cadre de cette plateforme, pourquoi, avec qui elles peuvent être partagées, et quels sont vos droits.
      </p>

      <Toc items={TOC} />

      <Section id="responsable" title="1. Responsable du traitement">
        <p>
          Le responsable du traitement des données personnelles décrites dans cette politique est :
        </p>
        <p style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', margin: '10px 0' }}>
          <strong>Agriculture pour le Bien Être et le Développement Durable (ABED-ONG)</strong><br />
          N° 2019-4/0008/PDB/SG/SAG du 16 janvier 2019 ; J.OFF du 15 juin 2022<br />
          Parakou, Quartier Zongo, République du Bénin<br />
          Tél. +229 01 67 77 91 41 · Email : contact@abedong.org
        </p>
      </Section>

      <Section id="cadre-legal" title="2. Cadre légal">
        <p>
          Ce traitement s'inscrit dans le cadre de la loi n° 2017-20 du 20 avril 2018 portant Code du numérique
          en République du Bénin, dont le titre relatif à la protection des données à caractère personnel encadre
          la collecte, le traitement et la conservation de ce type de données sur le territoire béninois, sous le
          contrôle de l'Autorité de Protection des Données à caractère Personnel (APDP).
        </p>
        <p>
          ABED-ONG s'engage à traiter les données décrites ci-dessous conformément aux principes de licéité,
          de finalité déterminée, de minimisation, d'exactitude, de limitation de la conservation et de sécurité
          posés par ce cadre.
        </p>
      </Section>

      <Section id="personnes" title="3. Personnes concernées">
        <p>Cette politique s'applique à toute personne dont des données sont traitées via My ABED, à savoir :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>le personnel</strong> disposant d'un compte My ABED (salariés, stagiaires, bénévoles, consultants, prestataires) ;</li>
          <li><strong>les signataires externes</strong> de contrats ou d'ordres de mission, qui accèdent au document via un lien sécurisé sans créer de compte ;</li>
          <li><strong>les visiteurs</strong> d'ABED-ONG qui s'enregistrent via le formulaire public de présence (lien ou QR code affiché à l'accueil).</li>
        </ul>
      </Section>

      <Section id="donnees" title="4. Données collectées">
        <p><strong>Personnel (comptes My ABED)</strong> — selon le rôle et les modules utilisés :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>identité et contact : civilité, nom, prénoms, email, téléphone, adresse, photo de profil ;</li>
          <li>données professionnelles : rôle, fonction, direction, type d'emploi, titre/grade, ancienneté ;</li>
          <li>données contractuelles et de rémunération : type de contrat, dates, poste, salaire ou taux, historique des documents RH (offres, contrats, conventions, avenants) et leur statut de signature ;</li>
          <li>données d'activité : missions et ordres de mission, congés, feuilles de temps, demandes de paiement, évaluations, projets et tâches, termes de référence ;</li>
          <li>signature électronique : rendu graphique de la signature, nom déclaré, date et heure de signature ;</li>
          <li>sécurité du compte : identifiant, mot de passe (jamais stocké en clair — géré par le système d'authentification), historique de connexion et de navigation dans l'application (adresse IP, type d'appareil/navigateur, pages consultées, horodatage), à des fins de traçabilité et de sécurité.</li>
        </ul>
        <p><strong>Signataires externes</strong> (sans compte) : nom, prénoms et adresse email déclarés pour recevoir le lien de signature, ainsi que la signature électronique et sa date. L'adresse IP et l'historique de navigation décrits ci-dessus ne sont pas collectés pour ces personnes.</p>
        <p><strong>Visiteurs</strong> (formulaire de présence) : nom, prénom, téléphone, email (facultatif), motif de la visite et réponses aux éventuelles questions complémentaires configurées par ABED-ONG (ex. structure représentée, personne à rencontrer), date et heure de l'enregistrement.</p>
      </Section>

      <Section id="finalites" title="5. Finalités et bases légales">
        <p>Ces données sont traitées pour les finalités suivantes :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>la gestion administrative et RH du personnel (contrats, paie, congés, évaluations, missions) — <em>exécution du contrat de travail, de la convention ou de l'engagement</em> liant la personne à ABED-ONG, et respect des obligations légales et comptables applicables ;</li>
          <li>la conclusion et le suivi de documents (contrats, ordres de mission) impliquant des tiers — <em>exécution du document accepté et signé</em> par la personne concernée ;</li>
          <li>la sécurité de la plateforme et la prévention des usages frauduleux (journal de connexion, protections anti-robot) — <em>intérêt légitime</em> d'ABED-ONG à sécuriser son système d'information ;</li>
          <li>la gestion des visites à l'accueil d'ABED-ONG — <em>consentement</em> de la personne au moment où elle remplit volontairement le formulaire de présence.</li>
        </ul>
      </Section>

      <Section id="destinataires" title="6. Destinataires et sous-traitants">
        <p>
          Les données sont accessibles, selon leur nature et dans la limite de ce qui est nécessaire à leurs fonctions,
          au personnel RH, à la Direction Exécutive et aux administrateurs habilités de My ABED. Un système de rôles
          et de permissions restreint l'accès de chaque utilisateur aux seules données pertinentes pour ses missions.
        </p>
        <p>Certains traitements techniques sont confiés à des prestataires (sous-traitants) qui agissent sur instruction d'ABED-ONG :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Supabase</strong> — hébergement de la base de données, authentification des comptes et stockage des documents/fichiers ;</li>
          <li><strong>Vercel</strong> — hébergement de l'application web My ABED ;</li>
          <li><strong>Resend</strong> — envoi des emails transactionnels (notifications, liens de signature, invitations).</li>
        </ul>
        <p>Ces prestataires n'utilisent les données que pour fournir le service technique concerné et ne sont pas autorisés à les exploiter à d'autres fins.</p>
      </Section>

      <Section id="transferts" title="7. Hébergement et transferts de données">
        <p>
          Les prestataires mentionnés ci-dessus opèrent une infrastructure cloud internationale, ce qui peut
          conduire à un hébergement des données en dehors du Bénin. ABED-ONG s'assure que ces prestataires
          présentent des garanties appropriées de sécurité et de confidentialité, et recommande la formalisation
          d'accords de traitement des données avec chacun d'eux lorsque ce n'est pas déjà le cas.
        </p>
      </Section>

      <Section id="conservation" title="8. Durées de conservation">
        <p>À titre indicatif, et sous réserve des obligations légales de conservation propres aux documents sociaux, comptables et fiscaux (à faire valider par un conseil juridique/comptable local) :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>les données d'un compte actif sont conservées pendant toute la durée de la relation avec ABED-ONG ;</li>
          <li>après la fin de cette relation, le compte est archivé plutôt que supprimé, afin de conserver l'historique des documents RH et financiers pendant la durée légalement requise ;</li>
          <li>les données des visiteurs (formulaire de présence) sont conservées 12 mois à compter de la visite ;</li>
          <li>le journal de connexion et de navigation est conservé 12 mois à des fins de sécurité, sauf besoin d'investigation particulier.</li>
        </ul>
      </Section>

      <Section id="securite" title="9. Sécurité des données">
        <p>ABED-ONG met en œuvre des mesures techniques et organisationnelles pour protéger vos données, notamment :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>connexions chiffrées (HTTPS) entre votre appareil et la plateforme ;</li>
          <li>authentification individuelle et contrôle d'accès par rôle : chaque utilisateur ne voit que les données pertinentes pour ses fonctions ;</li>
          <li>règles de sécurité au niveau de la base de données limitant l'accès direct aux données, y compris pour les traitements automatisés ;</li>
          <li>horodatage et traçabilité des signatures électroniques et des actions sensibles ;</li>
          <li>liens d'accès externes (documents à signer) limités dans le temps et propres à leur destinataire.</li>
        </ul>
      </Section>

      <Section id="droits" title="10. Vos droits">
        <p>Conformément au Code du numérique béninois, vous disposez, sur les données vous concernant, des droits suivants :</p>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>droit d'accès</strong> : obtenir la confirmation que vos données sont traitées et en recevoir une copie ;</li>
          <li><strong>droit de rectification</strong> : faire corriger des données inexactes ou incomplètes ;</li>
          <li><strong>droit d'opposition</strong> : vous opposer, pour motif légitime, à un traitement ;</li>
          <li><strong>droit à l'effacement</strong> : demander la suppression de vos données, dans la limite des obligations légales de conservation qui s'imposeraient à ABED-ONG ;</li>
          <li><strong>droit à la limitation</strong> du traitement dans certains cas.</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez ABED-ONG à <strong>contact@abedong.org</strong>. Une réponse vous sera
          apportée dans un délai raisonnable. Vous pouvez également adresser une réclamation à l'Autorité de
          Protection des Données à caractère Personnel (APDP) du Bénin.
        </p>
      </Section>

      <Section id="cookies" title="11. Cookies et traceurs">
        <p>
          My ABED utilise uniquement des cookies strictement nécessaires au fonctionnement du service, en
          particulier pour maintenir votre session de connexion. Aucun cookie publicitaire ou de mesure d'audience
          tiers n'est utilisé.
        </p>
      </Section>

      <Section id="modifications" title="12. Modifications de la politique">
        <p>
          Cette politique peut être mise à jour pour refléter l'évolution des fonctionnalités de My ABED ou du
          cadre légal applicable. La date de dernière mise à jour figure en haut de cette page ; les changements
          importants seront signalés au personnel par les canaux habituels (notification, email).
        </p>
      </Section>

      <Section id="contact" title="13. Contact et réclamations">
        <p>
          Pour toute question relative à cette politique ou à vos données personnelles :
          <br />ABED-ONG · Parakou, Quartier Zongo, Bénin
          <br />Email : <strong>contact@abedong.org</strong> · Tél. +229 01 67 77 91 41
        </p>
      </Section>

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 32, paddingTop: 16, borderTop: '1px dashed #e5e7eb' }}>
        Ce document décrit fidèlement les données réellement traitées par My ABED au moment de sa rédaction.
        Il est recommandé de le faire valider par un conseil juridique compétent en droit béninois — notamment
        pour confirmer les durées de conservation exactes et vérifier si une déclaration auprès de l'APDP est
        requise — avant de le considérer comme définitif.
      </p>
    </LegalPageLayout>
  )
}
