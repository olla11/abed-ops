-- =====================================================================
-- ABED-ONG — Génération des alertes de délai (à appeler par un cron quotidien)
-- =====================================================================
-- Politique : alerte 3 jours avant le 5 du mois (le 2) + le jour J (le 5).
-- À planifier via Supabase pg_cron OU un Vercel Cron qui appelle une route.
-- =====================================================================

create or replace function public.generer_alertes_delai()
returns int language plpgsql security definer as $$
declare
  aujourd_hui date := current_date;
  jour int := extract(day from current_date);
  ref_periode text := to_char(current_date, 'YYYY-MM');
  nb int := 0;
  presta record;
begin
  -- On cible les prestataires (direct + crédit) qui doivent soumettre
  -- timesheet/facture pour la période en cours et ne l'ont pas encore fait.
  if jour = 2 or jour = 5 then
    for presta in
      select p.id, p.prenoms, p.nom
      from public.profiles p
      where p.type_emploi in ('prestataire_direct','prestataire_credit')
        and not exists (
          select 1 from public.soumissions s
          where s.prestataire_id = p.id
            and s.type in ('timesheet','facture')
            and to_char(make_date(s.periode_annee, s.periode_mois, 1)
                        + interval '1 month', 'YYYY-MM') = ref_periode
        )
    loop
      declare
        type_alerte text := case when jour = 2 then 'timesheet_J-3' else 'timesheet_J0' end;
        titre_notif text := case when jour = 2
                              then 'Rappel : timesheet & facture dans 3 jours'
                              else 'Échéance aujourd''hui : timesheet & facture' end;
        msg text := case when jour = 2
                      then 'Vous avez jusqu''au 5 de ce mois pour soumettre votre timesheet, votre facture et vos livrables.'
                      else 'Dernier jour pour soumettre votre timesheet, facture et livrables. Toute soumission tardive peut reporter le paiement au cycle suivant.' end;
      begin
        -- éviter le doublon grâce à la contrainte unique
        begin
          insert into public.alertes_envoyees (user_id, type_alerte, reference)
          values (presta.id, type_alerte, ref_periode);
        exception when unique_violation then
          continue; -- déjà envoyée
        end;

        insert into public.notifications (user_id, titre, message, lien)
        values (presta.id, titre_notif, msg, '/timesheets');
        nb := nb + 1;
      end;
    end loop;
  end if;

  -- Rappel réconciliation de mission : 72h après le retour, si pas faite
  for presta in
    select m.id as mission_id, m.missionnaire_id, m.reference
    from public.missions m
    where m.status in ('signe','en_mission','reconciliation')
      and m.date_retour + interval '3 days' <= now()
      and (m.point_financier is null or m.rapport is null)
  loop
    begin
      insert into public.alertes_envoyees (user_id, type_alerte, reference)
      values (presta.missionnaire_id, 'rapport_mission_72h', presta.mission_id::text);
    exception when unique_violation then
      continue;
    end;

    update public.missions set status = 'reconciliation'
      where id = presta.mission_id and status <> 'reconciliation';

    insert into public.notifications (user_id, titre, message, lien)
    values (presta.missionnaire_id,
            'Réconciliation de mission requise',
            'Les 72h sont écoulées. Soumettez votre rapport et votre point financier pour clôturer la mission ' || coalesce(presta.reference,'') || '.',
            '/missions/' || presta.mission_id);
    nb := nb + 1;
  end loop;

  return nb;
end $$;

-- ---- Option A : planifier avec pg_cron (si activé sur le projet Supabase) ----
-- select cron.schedule('alertes-quotidiennes', '0 7 * * *',
--   $$ select public.generer_alertes_delai(); $$);
