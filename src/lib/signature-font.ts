// Vérifie que la police cursive BrittanySignature est réellement chargée et
// utilisable avant de rasteriser la signature dans un <canvas> (l'image ainsi
// produite est figée pour toujours dans le PDF signé — impossible de la
// corriger après coup si la mauvaise police a été utilisée).
export async function attendrePoliceSignature(fontSize: number): Promise<boolean> {
  const spec = `${fontSize}px BrittanySignature`
  for (let tentative = 0; tentative < 3; tentative++) {
    try {
      await Promise.race([
        Promise.all([document.fonts.load(spec), document.fonts.ready]),
        new Promise(resolve => setTimeout(resolve, 1500)),
      ])
    } catch { /* on vérifie quand même via document.fonts.check ci-dessous */ }

    if (document.fonts.check(spec)) return true
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  return document.fonts.check(spec)
}
