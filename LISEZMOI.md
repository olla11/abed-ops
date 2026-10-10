# Correctif : barre d'onglets mobile disparue

Cause : `src/components/AppHeader.tsx` dans le dépôt était revenu à l'ancienne version, qui n'affiche plus
`MobileTabBar`, `MobileMenuSheet` ni `MobileTableCards` (les fichiers `src/components/mobile/` sont bien
présents, mais personne ne les monte).

Remplacer uniquement `src/components/AppHeader.tsx` par celui-ci. Il reprend la version actuelle du dépôt
(y compris « Traiter les expressions de besoin » pour l'AAF) et y remonte la barre du bas + le menu mobile.

Attention : si un outil (Claude Code, autre IA, merge) retouche AppHeader.tsx, vérifier que ces 3 lignes restent :
  import MobileTabBar from './mobile/MobileTabBar'
  import MobileMenuSheet, { type MenuGroup } from './mobile/MobileMenuSheet'
  import MobileTableCards from './mobile/MobileTableCards'
