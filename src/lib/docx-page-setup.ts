import JSZip from 'jszip'

// Repère "page" de l'éditeur (voir tiptap-page-break.ts) : hauteur de texte
// utilisable par page, en pixels CSS. Par défaut on part d'une page A4 avec
// des marges d'1 pouce (le standard Word le plus courant) ; si le fichier
// importé précise sa propre mise en page (word/document.xml → <w:pgSz>,
// <w:pgMar>), on l'utilise à la place pour coller à la mise en page réelle
// du document plutôt qu'à une approximation générique.
const A4_HAUTEUR_TWIPS = 16838
const MARGE_1_POUCE_TWIPS = 1440
const TWIPS_PAR_POUCE = 1440
const PX_PAR_POUCE = 96

function twipsVersPx(twips: number): number {
  return Math.round((twips * PX_PAR_POUCE) / TWIPS_PAR_POUCE)
}

export const HAUTEUR_PAGE_PX_DEFAUT = twipsVersPx(A4_HAUTEUR_TWIPS)
export const HAUTEUR_CONTENU_PX_DEFAUT = twipsVersPx(A4_HAUTEUR_TWIPS - 2 * MARGE_1_POUCE_TWIPS)

/**
 * Lit la mise en page réelle d'un .docx (taille de page + marges haut/bas,
 * dans word/document.xml) et retourne la hauteur de texte utilisable par
 * page, en pixels CSS. Ne couvre que la première section du document — très
 * largement suffisant : l'immense majorité des documents Word n'ont qu'une
 * seule section, et les documents multi-sections partagent presque toujours
 * la même taille de page d'une section à l'autre.
 */
export async function extraireHauteurContenuDocx(buffer: Buffer): Promise<number | null> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const fichier = zip.file('word/document.xml')
    if (!fichier) return null
    const xml = await fichier.async('text')

    const pgSz = /<w:pgSz\b[^>]*\/>/.exec(xml)?.[0]
    const hMatch = pgSz ? /w:h="(\d+)"/.exec(pgSz) : null
    if (!hMatch) return null
    const hauteurTwips = parseInt(hMatch[1], 10)

    const pgMar = /<w:pgMar\b[^>]*\/>/.exec(xml)?.[0]
    const topMatch = pgMar ? /w:top="(-?\d+)"/.exec(pgMar) : null
    const bottomMatch = pgMar ? /w:bottom="(-?\d+)"/.exec(pgMar) : null
    const margeTopTwips = topMatch ? parseInt(topMatch[1], 10) : MARGE_1_POUCE_TWIPS
    const margeBottomTwips = bottomMatch ? parseInt(bottomMatch[1], 10) : MARGE_1_POUCE_TWIPS

    const hauteurContenuPx = twipsVersPx(hauteurTwips - margeTopTwips - margeBottomTwips)
    // Garde-fou : une valeur aberrante (mise en page paysage très large,
    // marges démesurées...) retombe sur la valeur par défaut plutôt que de
    // produire une pagination absurde (des pages minuscules ou géantes).
    if (hauteurContenuPx < 300 || hauteurContenuPx > 4000) return null
    return hauteurContenuPx
  } catch {
    return null
  }
}

/**
 * Détecte si un .docx est configuré en orientation paysage — via l'attribut
 * explicite `w:orient="landscape"`, ou à défaut en comparant largeur/hauteur
 * de page (`<w:pgSz>`). Sert à générer le PDF de signature dans la bonne
 * orientation plutôt qu'à toujours forcer un portrait A4 qui tronquerait un
 * document volontairement large (tableau étendu, etc.).
 */
export async function estDocxPaysage(buffer: Buffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const fichier = zip.file('word/document.xml')
    if (!fichier) return false
    const xml = await fichier.async('text')

    const pgSz = /<w:pgSz\b[^>]*\/>/.exec(xml)?.[0]
    if (!pgSz) return false
    if (/w:orient="landscape"/.test(pgSz)) return true
    if (/w:orient="portrait"/.test(pgSz)) return false

    const wMatch = /w:w="(\d+)"/.exec(pgSz)
    const hMatch = /w:h="(\d+)"/.exec(pgSz)
    if (!wMatch || !hMatch) return false
    return parseInt(wMatch[1], 10) > parseInt(hMatch[1], 10)
  } catch {
    return false
  }
}
