import { BRITTANY_SIGNATURE_FONT_DATA_URI } from './signature-font-data'

// Charge la police cursive BrittanySignature via l'API Font Loading (FontFace)
// et l'ajoute explicitement à document.fonts. Contrairement à un @font-face
// déclaré en CSS (dont le moment exact de disponibilité est ambigu — le DOM
// peut « repeindre » une fois la police prête, mais un <canvas> rasterisé une
// seule fois n'a pas cette chance), FontFace.load() renvoie une promesse qui
// ne se résout QUE lorsque la police est réellement parsée et utilisable :
// pas de délai arbitraire à faire courser contre le vrai chargement, donc pas
// de risque de dessiner avec la police de secours par excès de rapidité.
let chargementPolice: Promise<FontFace> | null = null

function chargerPoliceSignature(): Promise<FontFace> {
  if (!chargementPolice) {
    const fontFace = new FontFace('BrittanySignature', `url(${BRITTANY_SIGNATURE_FONT_DATA_URI})`)
    chargementPolice = fontFace.load().then(loaded => {
      document.fonts.add(loaded)
      return loaded
    })
  }
  return chargementPolice
}

// Attend que la police soit réellement prête avant de rasteriser la
// signature dans un <canvas>. La police étant embarquée en data URI (aucune
// requête réseau), ce chargement est déterministe et rapide — mais on
// l'attend jusqu'au bout, sans jamais couper court.
export async function attendrePoliceSignature(): Promise<void> {
  try {
    await chargerPoliceSignature()
  } catch (err) {
    console.error('[Signature] Échec du chargement de la police BrittanySignature:', err)
  }
}
