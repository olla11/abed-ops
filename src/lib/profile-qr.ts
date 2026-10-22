import { TITRE_LABELS, type Titre } from '@/lib/roles'

// Carte de visite au format vCard : un lecteur de QR code (ou l'appareil
// photo d'un smartphone) propose directement "Ajouter aux contacts" avec le
// nom, le poste et l'email déjà remplis, plutôt qu'un simple texte à copier.
export function buildProfileVCard(p: { nom: string; prenoms: string; titre: Titre | string | null; email: string | null }): string {
  const poste = p.titre ? (TITRE_LABELS[p.titre as Titre] ?? p.titre) : ''
  const lignes = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${p.nom};${p.prenoms};;;`,
    `FN:${p.prenoms} ${p.nom}`,
    'ORG:ABED-ONG',
    poste ? `TITLE:${poste}` : null,
    p.email ? `EMAIL:${p.email}` : null,
    'END:VCARD',
  ]
  return lignes.filter(Boolean).join('\n')
}
