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

// Les n derniers jours ouvrés (lun-ven), le plus récent en premier,
// remontant depuis `depuis` inclus s'il est lui-même ouvré.
export function joursOuvresRecents(n: number, depuis: Date = new Date()): string[] {
  const jours: string[] = []
  const cursor = localBenin(depuis)
  while (jours.length < n) {
    const jourSemaine = cursor.getUTCDay()
    if (jourSemaine !== 0 && jourSemaine !== 6) jours.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return jours
}
