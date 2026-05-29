# ABED-ONG — Système de gestion des opérations

Plateforme web (Next.js 14 + Supabase) pour ABED-ONG : ordres de mission,
réconciliation post-mission avec prélèvement automatique de 20 %, et timesheets.

## Ce qui est inclus dans ce démarrage

| Module | Fichiers |
|---|---|
| Schéma DB + RLS + triggers | `supabase/schema.sql` |
| Auth (login, middleware) | `src/app/login/`, `src/middleware.ts` |
| Dashboard | `src/app/dashboard/` |
| Réconciliation (point financier + rapport + 20 %) | `src/components/ReconciliationForm.tsx`, `src/app/api/missions/reconcile/` |
| Prélèvement Mobile Money | `src/lib/fedapay.ts`, `src/app/api/fedapay/webhook/` |
| PDF de l'OM signé | `src/app/api/om-pdf/` |

## Workflow couvert

1. **Demande d'OM** → le missionnaire crée la mission (statut `soumis`).
2. **Signature** → la CAF ou le DE signe ; statut `signe`, le PDF devient
   téléchargeable, une notification + email part vers le missionnaire.
3. **Après la mission** → à `date_retour + 72h`, le système réclame la
   réconciliation (rapport + point financier).
4. **Point financier validé** → si mission à charge d'un partenaire, le système
   calcule **20 % des frais reçus** et envoie un **push MTN Mobile Money** via
   FedaPay. Le missionnaire confirme sur son téléphone.
5. **Webhook FedaPay confirmé** → la mission passe à `cloture`. C'est le webhook
   signé, jamais le retour client, qui valide définitivement.
6. **Timesheets** → le prestataire soumet, son responsable direct (champ
   `manager_id`) valide.

## Installation

```bash
npm install
cp .env.local.example .env.local   # puis remplir les clés
```

### 1. Supabase
- Créez un projet sur https://supabase.com
- SQL Editor → collez et exécutez `supabase/schema.sql`
- Authentication → activez Email/Password
- Copiez l'URL, l'anon key et la service_role key dans `.env.local`
- Storage → créez un bucket `om-pdfs` (privé) pour les PDF signés

### 2. FedaPay
- Compte sur https://fedapay.com (commencez en **sandbox**)
- Dashboard → API Keys → copiez les clés sandbox dans `.env.local`
- Webhooks → ajoutez `https://VOTRE-DOMAINE/api/fedapay/webhook`
  et copiez le secret de signature dans `FEDAPAY_WEBHOOK_SECRET`
- Le prélèvement utilise le mode `mtn_open` (MTN MoMo Bénin).
  ⚠ Vérifiez les noms de champs exacts dans la doc à jour : la séquence est
  *créer transaction → générer token → définir le mode de paiement*.

### 3. Lancer
```bash
npm run dev      # http://localhost:3000
```

### 4. Déployer
Poussez sur GitHub → importez dans Vercel → ajoutez les variables
d'environnement → déployez. Pensez à mettre `NEXT_PUBLIC_APP_URL` sur l'URL
de production et à pointer le webhook FedaPay dessus.

## Règle des 20 %

Le calcul est centralisé dans le trigger SQL `compute_reconciliation()` ET
re-vérifié côté serveur : **20 % du montant reçu du partenaire**, uniquement si
`a_charge_partenaire = true`. Modifier la règle = modifier ces deux endroits.

## Titres, rôles et accès

- `src/lib/roles.ts` définit les **titres** (issus des politiques RH & rémunération),
  les **types d'emploi** et le mapping **titre → niveau d'accès**.
- À la création d'un compte, le personnel n'a pas de titre. **Admin, RH ou CAF**
  attribuent le titre via `src/components/GestionTitres.tsx`, qui appelle la fonction
  SQL `attribuer_titre()`. Le niveau d'accès (role) est déduit automatiquement.
- Niveaux d'accès : `missionnaire`, `manager`, `rh`, `caf`, `de`, `admin`.

## Soumissions des prestataires (timesheets, factures, livrables)

- `src/components/SoumissionForm.tsx` : le prestataire soumet et **donne un titre**
  à chaque soumission (timesheet / facture / livrable), avec pièce jointe.
- `src/components/ValidationManager.tsx` : le **responsable direct** (`manager_id`)
  valide ou rejette, conformément à la validation technique de PO-03.
- Storage : créez un bucket privé `livrables` dans Supabase.

## Alertes de délai (automatiques)

Conformément aux procédures, les soumissions sont dues **le 5 du mois suivant**.
La fonction `generer_alertes_delai()` (migration 003) envoie :
- aux prestataires : un rappel **le 2** (J-3) et **le 5** (jour J) s'ils n'ont pas soumis ;
- aux missionnaires : une réclamation de réconciliation **72h après le retour**.

Planification au choix :
- **Vercel Cron** (`vercel.json`) appelle `/api/cron/alertes` chaque jour à 7h
  (protégé par `CRON_SECRET`).
- **ou pg_cron** dans Supabase (voir commentaire en bas de la migration 003).

## Ordre d'exécution des SQL

1. `supabase/schema.sql`
2. `supabase/migration_002_roles_livrables.sql`
3. `supabase/migration_003_alertes_cron.sql`

## Ce qu'il reste à faire (prochaines étapes)

- Page de création/signature d'OM (formulaire + bouton signer pour CAF/DE)
- Génération de la `reference` OM à la signature (séquence annuelle)
- Cron (Supabase Edge Function ou Vercel Cron) pour déclencher la réclamation
  de réconciliation à `date_retour + 72h`
- Envoi réel des emails (brancher Resend dans les routes)
- Pages timesheets (soumission + validation manager)
- Tests du flux FedaPay en sandbox avant le passage en live
