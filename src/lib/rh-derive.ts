// Dérivations automatiques utilisées par RH pour éviter de ressaisir une
// information déjà connue par ailleurs.

// Genre déduit de la civilité — seuls M./Mme sont sans ambiguïté ; Dr/Pr ou
// une civilité absente ne permettent pas de déduire le genre (laissé à
// renseigner manuellement dans ce cas).
export function civiliteToGenre(civilite: string | null | undefined): 'M' | 'F' | null {
  if (civilite === 'M.') return 'M'
  if (civilite === 'Mme') return 'F'
  return null
}

// Ville déduite de l'adresse complète : dans les adresses saisies chez ABED,
// la ville est presque toujours le premier segment ("Parakou, Bénin",
// "Cotonou, quartier X..."), pas le dernier (qui est souvent le pays ou un
// détail de quartier). Sans virgule, on ne devine pas — mieux vaut laisser
// vide qu'afficher un mot qui n'est pas une ville.
export function deriveVilleFromAdresse(adresse: string | null | undefined): string | null {
  if (!adresse) return null
  const parts = adresse.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  return parts[0]
}

// Génère le prochain matricule au format ABED-0001, ABED-0002... en se
// basant sur le plus grand numéro déjà attribué (pas de séquence Postgres :
// le volume de créations de comptes est trop faible pour justifier la
// complexité d'une séquence concurrente).
export async function genererMatricule(admin: { from: (t: string) => any }): Promise<string> {
  const { data } = await admin.from('profiles').select('matricule').not('matricule', 'is', null)
  let max = 0
  for (const row of (data ?? []) as { matricule: string | null }[]) {
    const m = /^ABED-(\d+)$/.exec(row.matricule ?? '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `ABED-${String(max + 1).padStart(4, '0')}`
}
