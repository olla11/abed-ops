# Base de connaissances AGA

Dépose ici des fichiers `.pdf`, `.txt` ou `.md` contenant des infos sur ABED
(historique, mission, valeurs, actualités, rapports...). AGA les lit
automatiquement à chaque conversation et s'en sert comme contexte.

Comment ajouter un fichier sans toucher au code :
1. Sur GitHub, ouvre ce dossier `knowledge/`.
2. Bouton "Add file" → "Upload files".
3. Dépose le(s) PDF/texte, commit directement sur `main`.
4. Redéploie sur Vercel (ou attends le redéploiement auto si activé).

Limites :
- Le contenu total injecté est plafonné (~60 000 caractères) pour rester
  raisonnable en coût/latence — si la base grossit beaucoup, il faudra
  passer à une recherche par similarité (RAG) plutôt qu'une injection brute.
- Les PDF scannés (images sans texte) ne sont pas lisibles tels quels.
