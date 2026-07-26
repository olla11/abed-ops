// Sujets d'intérêt du centre de préférences opt-in : chaque utilisateur
// choisit librement ceux qu'il veut recevoir depuis son profil, et peut s'en
// retirer à tout moment. Utilisé à la fois par la page profil (préférences)
// et par l'admin (filtre de ciblage des communications).
export const NOTIFICATION_TOPICS = [
  { value: 'rh', label: 'Ressources humaines' },
  { value: 'projets', label: 'Projets & missions' },
  { value: 'formations', label: 'Formations' },
  { value: 'evenements', label: 'Événements' },
  { value: 'finances', label: 'Finances & paiements' },
  { value: 'general', label: 'Actualités générales' },
] as const

export type NotificationTopic = typeof NOTIFICATION_TOPICS[number]['value']
