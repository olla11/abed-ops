import { BRITTANY_B64 } from './brittany-font'

// Réutilise l'encodage base64 déjà présent dans brittany-font.ts (utilisé
// côté serveur pour l'embarquement PDF) pour construire une data URI CSS
// @font-face — le rendu de la signature ne dépend plus d'une requête réseau
// séparée vers /fonts/BrittanySignature.ttf, qui pouvait échouer ou traîner
// sur une connexion instable et empêcher de signer.
export const BRITTANY_SIGNATURE_FONT_DATA_URI = `data:font/truetype;base64,${BRITTANY_B64}`
