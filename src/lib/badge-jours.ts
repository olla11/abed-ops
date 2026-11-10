// Bénin (Africa/Porto-Novo) = UTC+1 fixe, jamais d'heure d'été — un simple
// décalage constant suffit, pas besoin d'Intl/zoneinfo pour ça.
const DECALAGE_BENIN_MS = 1 * 60 * 60 * 1000

function localBenin(d: Date): Date {
  return new Date(d.getTime() + DECALAGE_BENIN_MS)
}

// Heure locale en minutes depuis minuit (ex. 9h05 → 545) — sert à détecter
// une entrée après 9h ou une sortie avant 17h (voir /api/badge/pointer).
export function heureLocaleMinutes(d: Date = new Date()): number {
  const l = localBenin(d)
  return l.getUTCHours() * 60 + l.getUTCMinutes()
}

// Début de la journée locale (minuit Bénin), en UTC — pour les requêtes
// "aujourd'hui" sur badge_pointages.horodatage.
export function debutJourLocal(d: Date = new Date()): Date {
  const l = localBenin(d)
  l.setUTCHours(0, 0, 0, 0)
  return new Date(l.getTime() - DECALAGE_BENIN_MS)
}

// Date locale au format 'YYYY-MM-DD' (comparable à conges.date_debut/fin).
export function dateLocaleISO(d: Date = new Date()): string {
  return localBenin(d).toISOString().slice(0, 10)
}

// Jour de la semaine local (0=dimanche...6=samedi) — comparable à
// profiles.badge_jours_semaine (1=lundi...5=vendredi).
export function jourSemaineLocal(d: Date = new Date()): number {
  return localBenin(d).getUTCDay()
}

// Un badgeage est-il attendu ce jour-là pour ce planning ? null/vide =
// tous les jours ouvrés (lun-ven).
export function jourAttendu(joursSemaine: number[] | null | undefined, d: Date = new Date()): boolean {
  const jour = jourSemaineLocal(d)
  if (joursSemaine && joursSemaine.length > 0) return joursSemaine.includes(jour)
  return jour >= 1 && jour <= 5
}

// Les n derniers jours où un badgeage est attendu, le plus récent en
// premier, remontant depuis `depuis` inclus s'il est lui-même attendu.
// `joursSemaine` (1=lundi...5=vendredi) restreint aux jours d'un planning
// de télétravail partiel — null/vide = tous les jours ouvrés (lun-ven).
export function joursAttendusRecents(n: number, joursSemaine: number[] | null | undefined, depuis: Date = new Date()): string[] {
  const attendus = joursSemaine && joursSemaine.length > 0 ? new Set(joursSemaine) : new Set([1, 2, 3, 4, 5])
  const jours: string[] = []
  const cursor = localBenin(depuis)
  while (jours.length < n) {
    if (attendus.has(cursor.getUTCDay())) jours.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return jours
}

// Les n derniers jours ouvrés (lun-ven) — cas par défaut de
// joursAttendusRecents, pour un employé sans planning particulier.
export function joursOuvresRecents(n: number, depuis: Date = new Date()): string[] {
  return joursAttendusRecents(n, null, depuis)
}
