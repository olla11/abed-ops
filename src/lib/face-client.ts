'use client'
// Détection + calcul du gabarit facial (128 nombres), entièrement dans le
// navigateur via face-api.js — aucune photo n'est jamais envoyée au
// serveur pour cette comparaison, seulement ce tableau de nombres. Les
// modèles pré-entraînés sont servis statiquement depuis /models (voir
// public/models/).
//
// Distance euclidienne entre deux gabarits < SEUIL_MEME_VISAGE = même
// personne — c'est la convention documentée de face-api.js, reprise aussi
// côté serveur (src/lib/face-server.ts) pour la vraie décision de sécurité.
export const SEUIL_MEME_VISAGE = 0.6

let modelsPromise: Promise<void> | null = null

export function chargerModelesVisage(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const faceapi = await import('face-api.js')
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ])
    })()
  }
  return modelsPromise
}

// Retourne null si aucun visage net n'est détecté sur l'image (photo floue,
// cadrage raté, personne absente...) — à l'appelant de redemander une photo.
export async function calculerGabaritVisage(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<number[] | null> {
  const faceapi = await import('face-api.js')
  await chargerModelesVisage()
  const resultat = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!resultat) return null
  return Array.from(resultat.descriptor)
}
