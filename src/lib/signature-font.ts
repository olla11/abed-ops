// Laisse une chance à la police cursive BrittanySignature de finir de se
// préparer avant de rasteriser la signature dans un <canvas>. La police est
// embarquée dans le bundle (data URI, voir signature-font-data.ts) — elle ne
// dépend donc plus d'une requête réseau séparée qui pouvait échouer. C'est
// un best-effort : on n'empêche jamais de signer sur cette base, car
// `document.fonts.check()` peut répondre "pas prête" par excès de prudence
// (ex: FontFace pas encore utilisée dans un rendu déjà à l'écran) alors que
// la police est en réalité disponible et s'affiche déjà correctement.
export async function attendrePoliceSignature(fontSize: number): Promise<void> {
  const spec = `${fontSize}px BrittanySignature`
  try {
    await Promise.race([
      Promise.all([document.fonts.load(spec), document.fonts.ready]),
      new Promise(resolve => setTimeout(resolve, 1000)),
    ])
  } catch { /* la police est embarquée dans le bundle, donc quasi toujours déjà prête */ }
}
