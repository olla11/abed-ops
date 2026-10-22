import { TITRE_LABELS, type Titre } from '@/lib/roles'

// Carte de visite au format vCard : un lecteur de QR code (ou l'appareil
// photo d'un smartphone) propose directement "Ajouter aux contacts" avec le
// nom, le poste et l'email déjà remplis, plutôt qu'un simple texte à copier.
//
// Pas de champ ORG volontairement : son intitulé affiché ("Société",
// "Entreprise"...) est choisi par l'appli qui lit le QR, pas par le contenu
// du vCard — impossible à renommer en "Organisation" depuis ce fichier.
// "ABED-ONG" est donc intégré directement au champ Titre à la place.
export function buildProfileVCard(p: { nom: string; prenoms: string; titre: Titre | string | null; email: string | null; telephone: string | null }): string {
  const poste = p.titre ? (TITRE_LABELS[p.titre as Titre] ?? p.titre) : ''
  const titreComplet = poste ? `${poste} — ABED-ONG` : 'ABED-ONG'
  const lignes = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${p.nom};${p.prenoms};;;`,
    `FN:${p.prenoms} ${p.nom}`,
    `TITLE:${titreComplet}`,
    p.email ? `EMAIL:${p.email}` : null,
    p.telephone ? `TEL;TYPE=CELL,VOICE:${p.telephone}` : null,
    'END:VCARD',
  ]
  return lignes.filter(Boolean).join('\n')
}
