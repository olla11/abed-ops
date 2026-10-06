# My ABED — version mobile (prototype appliqué à l'app réelle)

Analysé sur `olla11/abed-ops@main` (6 oct. 2026). Copier le dossier `src/`
par-dessus celui du dépôt (mêmes chemins), puis commit + push.

## Fichiers

Nouveaux :
- `src/components/mobile/MobileTabBar.tsx` — barre d'onglets en bas (≤768px), adaptée au rôle
- `src/components/mobile/MobileMenuSheet.tsx` — menu plein écran (onglet « Menu »), icônes Lucide
- `src/components/mobile/MobileTableCards.tsx` — étiquette les cellules pour l'affichage en cartes

Modifiés :
- `src/components/AppHeader.tsx` — monte les 3 composants ci-dessus ; desktop **inchangé** ;
  l'ancien menu hamburger déroulant est remplacé par le menu plein écran
- `src/app/globals.css` — toute la couche mobile (ajouts uniquement, le desktop ne bouge pas)
- `src/components/AgaWidget.tsx` — bulle AGA **déplaçable** (doigt ou souris) : appui = ouvrir,
  glisser = déplacer ; se colle au bord gauche/droit, position mémorisée sur toutes les pages,
  ne descend jamais sur la barre d'onglets ; sur mobile la fenêtre de chat tient entre l'en-tête et la barre
- `src/components/AccueilClient.tsx` — classe `accueil-shortcuts`, raccourcis DP ajoutés,
  raccourcis DE pointés vers `/de/om-a-signer` et `/de/demandes-paiement`

## Ce que ça donne sur mobile, pour tous les rôles

AppHeader est rendu sur toutes les pages connectées, donc tout le système est couvert.

Onglets du bas selon le rôle (+ « Menu » toujours en dernier) :
- Missionnaire / Manager / Prestataire : Accueil · Missions · Paiements
- DE : Accueil · OM à signer · Paiements
- DP : Accueil · Vue d'ensemble · Missions
- AAF : Accueil · Paiements · Réconciliations
- CAF : Accueil · CAF Pro · Paiements
- RH : Accueil · RH · Congés
- Administrateur (CA) : Accueil · Vue d'ensemble · Missions
- Admin / Superadmin : Accueil · Vue d'ensemble · Admin
- Titre Business Developer : Accueil · BD · Missions

Partout :
- **Tableaux → cartes** : chaque ligne devient une carte (intitulé de colonne à gauche,
  valeur à droite), comme les listes du prototype. Pour garder un tableau classique :
  `className="no-mobile-cards"`.
- **Sous-menus de section** (Mon espace, DE, CAF, AAF, RH, Admin, BD, TdR) : pastilles qui
  défilent horizontalement, collées sous l'en-tête.
- Champs à 16px (plus de zoom iOS), boutons 44px mini, modales limitées à la largeur d'écran.

## À vérifier après déploiement

- Les tableaux avec beaucoup d'actions/inputs par ligne peuvent rendre mieux en mode
  classique — mets-leur `no-mobile-cards` au cas par cas.
- Les traductions anglaises des libellés du menu mobile ajoutés (Accueil, Documents…)
  sont en dur en français, comme `MonEspaceNav`.
