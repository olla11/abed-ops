// Comparaison de deux gabarits faciaux (128 nombres chacun), calculée côté
// serveur — c'est elle, pas le navigateur, qui décide si le selfie
// correspond à la photo de référence (voir src/lib/face-client.ts pour le
// calcul du gabarit, strictement identique à celui utilisé ici, même seuil).
export const SEUIL_MEME_VISAGE = 0.6

export function distanceEuclidienne(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let somme = 0
  for (let i = 0; i < a.length; i++) somme += (a[i] - b[i]) ** 2
  return Math.sqrt(somme)
}

export function memeVisage(gabaritSelfie: number[], gabaritReference: number[]): boolean {
  return distanceEuclidienne(gabaritSelfie, gabaritReference) < SEUIL_MEME_VISAGE
}
