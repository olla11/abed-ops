-- Nouveau titre "Responsable Hub" — identifie qui a la charge du Hub
-- (Espaces/Projets), sans droits système dédiés pour l'instant : mêmes
-- capacités qu'un manager, comme business_developer/responsable_communication.
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'responsable_hub';
