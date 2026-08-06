-- Chaque signataire garde désormais son tampon (image PNG déjà rendue
-- côté client, encodée en base64) en base plutôt que de dépendre d'un
-- fichier PDF partagé progressivement muté à chaque signature. Ce fichier
-- partagé pouvait perdre une signature précédente en cas d'incohérence de
-- lecture après écriture sur le stockage : le PDF final signé est
-- désormais recomposé à la demande depuis le PDF original (jamais modifié
-- après son upload initial) + l'ensemble des tampons enregistrés ici.
ALTER TABLE public.signataires ADD COLUMN IF NOT EXISTS sig_image_b64 text;
