// Accord de genre basé sur la civilité d'un profil ('M.' | 'Mme' | 'Dr' | 'Pr').
// Seule 'Mme' est traitée comme féminin — comportement déjà en usage dans le
// reste du code (contrat-pdf, om-pdf, cron anniversaires) : 'Dr'/'Pr' n'indiquent
// pas de genre en soi et sont traités par défaut comme masculin.
export function estFeminin(civilite: string | null | undefined): boolean {
  return civilite === 'Mme'
}

export function accordGenre(civilite: string | null | undefined, masculin: string, feminin: string): string {
  return estFeminin(civilite) ? feminin : masculin
}
