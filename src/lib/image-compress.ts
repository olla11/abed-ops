// Compresse une image côté client avant envoi — une photo prise directement
// au téléphone pèse souvent 3 à 8 Mo, ce qui échoue silencieusement sur une
// connexion mobile lente ou dépasse la limite de taille de requête des
// fonctions serverless (Vercel : 4,5 Mo au total). Redimensionner et
// recompresser en JPEG avant l'envoi ramène généralement le fichier à
// quelques centaines de Ko sans perte de lisibilité notable.
//
// Ne touche jamais aux fichiers non-image (ex. un PDF de pièce d'identité) :
// ils sont renvoyés tels quels.
export async function compressImageFile(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    // Déjà assez petite : pas la peine de repasser par un canvas (risque
    // de regonfler un PNG déjà optimisé en le réencodant).
    const DEJA_LEGERE = 1.5 * 1024 * 1024
    if (scale >= 1 && file.size <= DEJA_LEGERE) { bitmap.close?.(); return file }

    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Navigateur sans createImageBitmap/canvas fonctionnel, image corrompue…
    // — on envoie le fichier d'origine plutôt que de bloquer l'utilisateur.
    return file
  }
}
