-- Bug trouvé : can_access_projet ne vérifiait "created_by = auth.uid()" que
-- pour les projets SANS espace — pour un projet rattaché à un espace, seule
-- l'appartenance à l'espace (is_espace_member) comptait. Résultat : créer un
-- projet dans un espace dont on n'est pas formellement membre (ex. visible
-- via une policy plus large, ou un cache de sidebar obsolète) faisait
-- échouer le SELECT/RETURNING juste après l'INSERT — Postgres/PostgREST
-- remonte alors "new row violates row-level security policy", alors que
-- l'INSERT lui-même avait réussi. Le créateur d'un projet doit toujours
-- pouvoir le voir, qu'il soit ou non membre de l'espace qui le contient.
CREATE OR REPLACE FUNCTION public.can_access_projet(p_projet_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM projets_internes p
    WHERE p.id = p_projet_id
    AND (
      p.created_by = auth.uid()
      OR (p.espace_id IS NULL AND (
        p.is_public = true
        OR EXISTS (SELECT 1 FROM activites a WHERE a.projet_id = p.id AND a.assignee_id = auth.uid())
      ))
      OR (p.espace_id IS NOT NULL AND public.is_espace_member(p.espace_id))
    )
  );
$function$;
