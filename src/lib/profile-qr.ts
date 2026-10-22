import { TITRE_LABELS, type Titre } from '@/lib/roles'

// Carte de visite au format vCard : un lecteur de QR code (ou l'appareil
// photo d'un smartphone) propose directement "Ajouter aux contacts" avec le
// nom, le poste et l'email déjà remplis, plutôt qu'un simple texte à copier.
//
// Le champ standard ORG (ci-dessous) est ce que la norme vCard appelle
// "organisation" — mais son intitulé affiché ("Société", "Entreprise",
// "Organisation"...) est choisi par l'OS/l'appli qui lit le QR (Contacts
// iOS l'affiche en français sous "Société"), pas par le contenu du vCard :
// impossible à changer depuis ce fichier. La ligne NOTE ci-dessous ajoute
// donc le mot "Organisation" en toutes lettres dans un champ de texte
// libre, pour les lecteurs qui l'affichent tel quel.
export function buildProfileVCard(p: { nom: string; prenoms: string; titre: Titre | string | null; email: string | null; telephone: string | null }): string {
  const poste = p.titre ? (TITRE_LABELS[p.titre as Titre] ?? p.titre) : ''
  const lignes = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${p.nom};${p.prenoms};;;`,
    `FN:${p.prenoms} ${p.nom}`,
    'ORG:ABED-ONG',
    'NOTE:Organisation : ABED-ONG',
    poste ? `TITLE:${poste}` : null,
    p.email ? `EMAIL:${p.email}` : null,
    p.telephone ? `TEL;TYPE=CELL,VOICE:${p.telephone}` : null,
    'END:VCARD',
  ]
  return lignes.filter(Boolean).join('\n')
}
