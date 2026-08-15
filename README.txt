6 fichiers modifiés/créés + 2 fichiers à SUPPRIMER manuellement (n'existent
plus dans ce zip, il faut les effacer toi-même dans ton clone local) :

  src/lib/docx-fix.ts
  src/types/html-to-docx.d.ts

IMPORTANT — changement de dépendance npm : après avoir collé les fichiers
(et supprimé les 2 ci-dessus), lance :

  npm uninstall html-to-docx
  npm install docx

avant de redémarrer/rebuilder le projet.

Le reste : décompresse et colle par-dessus ton clone local (structure src/
préservée).
