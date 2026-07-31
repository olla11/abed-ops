-- Migration 072 : étape de validation AAF avant la CAF sur la réconciliation de mission

ALTER TYPE om_status ADD VALUE IF NOT EXISTS 'reconciliation_aaf';
