// Modèles de contrat : le texte légal standard est stocké une fois par
// (type_contrat, categorie_document) avec des espaces réservés {{cle}},
// substitués à la création du document — la RH ne retape plus l'article,
// elle remplit juste les quelques champs déclarés par le modèle.

export type ChampTemplateType = 'text' | 'textarea' | 'date' | 'number'

export type ChampTemplate = {
  cle: string
  libelle: string
  type: ChampTemplateType
  requis?: boolean
  defaut?: string
  aide?: string
}

export type ArticleTemplate = { titre: string; contenu: string }

export type ContratTemplate = {
  id: string
  nom: string
  type_contrat: string
  categorie_document: string
  objet_template: string | null
  articles: ArticleTemplate[]
  champs: ChampTemplate[]
  actif: boolean
}

// "1er Septembre 2025" — format utilisé dans les conventions/avenants papier.
export function formatDateLettres(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const jour = d.getDate()
  const mois = d.toLocaleDateString('fr-FR', { month: 'long' })
  const annee = d.getFullYear()
  return `${jour === 1 ? '1er' : jour} ${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${annee}`
}

function substituer(texte: string, valeurs: Record<string, string>): string {
  return texte.replace(/\{\{(\w+)\}\}/g, (match, cle) => (cle in valeurs ? valeurs[cle] : match))
}

// Applique les valeurs (champs déclarés par le modèle + variables intégrées
// comme date_debut_texte) à objet_template et à chaque article du modèle.
export function genererDepuisTemplate(
  template: Pick<ContratTemplate, 'objet_template' | 'articles'>,
  valeurs: Record<string, string>,
): { objet: string; articles: ArticleTemplate[] } {
  return {
    objet: template.objet_template ? substituer(template.objet_template, valeurs) : '',
    articles: template.articles.map(a => ({
      titre: substituer(a.titre, valeurs),
      contenu: substituer(a.contenu, valeurs),
    })),
  }
}

// Repère les {{cle}} restés non substitués (champ requis oublié, faute de
// frappe dans un {{cle}} du modèle...) — pour avertir la RH avant l'envoi.
export function placeholdersRestants(texte: string): string[] {
  const trouves = new Set<string>()
  for (const m of texte.matchAll(/\{\{(\w+)\}\}/g)) trouves.add(m[1])
  return [...trouves]
}
