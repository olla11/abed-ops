-- Migration 074 : étape d'autorisation DE après la validation CAF sur la réconciliation de mission

ALTER TYPE om_status ADD VALUE IF NOT EXISTS 'reconciliation_de';
