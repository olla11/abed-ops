# Notes pour Claude — My ABED (abed-ops)

## Supabase — GRANT obligatoire sur toute nouvelle table (à partir du 30 octobre 2026)

Depuis un mail Supabase reçu le 25/09/2026 : à partir du **30 octobre 2026**,
Supabase arrête d'accorder automatiquement l'accès Data API (PostgREST/
GraphQL, ce qu'utilise `supabase-js`) aux nouvelles tables créées dans le
schéma `public`. Sans `GRANT` explicite, toute nouvelle table renvoie
"permission denied" dès qu'on essaie d'y accéder via l'API.

Les tables déjà existantes ne sont pas concernées (elles gardent leurs
droits actuels, rien à faire pour elles).

**Donc : à chaque migration qui crée une nouvelle table**, ajouter ces
lignes dans la même migration (à ajuster selon les besoins réels — par
exemple omettre le `grant ... to anon` si la table ne doit jamais être
lisible par un visiteur non connecté ; la RLS continue de gérer la finesse
des droits ligne par ligne comme d'habitude) :

```sql
grant select on public.ma_nouvelle_table to anon;
grant select, insert, update, delete on public.ma_nouvelle_table to authenticated;
grant select, insert, update, delete on public.ma_nouvelle_table to service_role;
```
