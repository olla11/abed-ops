-- La table notifications n'avait aucune politique INSERT pour les
-- utilisateurs authentifiés (seulement SELECT/UPDATE sur ses propres
-- lignes) — alors que presque toutes les notifications de l'appli sont
-- envoyées à quelqu'un d'autre que l'auteur de l'action (responsable,
-- CAF, AAF, DE, prestataire...). Toute notification insérée via le
-- client authentifié normal (pas service-role) échouait donc
-- silencieusement. C'est entièrement piloté par la logique serveur des
-- routes API, jamais par un appel client-side libre : une politique
-- ouverte à l'écriture est le comportement réellement voulu.
CREATE POLICY "inserer une notification" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
