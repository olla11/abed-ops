import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Profile utilisateur ────────────────────────────────────────────────────────
export const getCachedProfile = (userId: string) =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('profiles')
        .select('id, nom, prenoms, role, avatar_url, type_emploi, manager_id, fonction, email')
        .eq('id', userId)
        .single()
      return data
    },
    [`profile-${userId}`],
    { tags: [`profile-${userId}`, 'profiles'], revalidate: 300 }
  )()

// ── Personnel RH (liste globale — actifs uniquement) ──────────────────────────
export const getCachedPersonnel = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('profiles')
        .select('id, nom, prenoms, role, type_emploi, direction, fonction, email, telephone, civilite, manager_id')
        .neq('role', 'admin')
        .eq('archived', false)
        .order('prenoms')
      return data ?? []
    },
    ['personnel-list'],
    { tags: ['personnel', 'profiles'], revalidate: 600 }
  )()

// ── Managers (dropdown — actifs uniquement) ────────────────────────────────────
export const getCachedManagers = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('profiles')
        .select('id, nom, prenoms, role, email, avatar_url, type_emploi')
        .in('role', ['admin', 'rh', 'de', 'caf', 'manager', 'aaf'])
        .eq('archived', false)
        .order('prenoms')
      return data ?? []
    },
    ['managers-list'],
    { tags: ['managers', 'profiles'], revalidate: 600 }
  )()

// ── Types de congé (référentiel) ───────────────────────────────────────────────
export const getCachedTypesConge = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('types_conge')
        .select('*')
        .eq('actif', true)
        .order('nom')
      return data ?? []
    },
    ['types-conge'],
    { tags: ['types-conge'], revalidate: 3600 }
  )()

// ── Contrats (liste RH) ────────────────────────────────────────────────────────
export const getCachedContrats = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('contrats')
        .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
        .order('date_fin', { ascending: true, nullsFirst: false })
      return data ?? []
    },
    ['contrats-list'],
    { tags: ['contrats'], revalidate: 300 }
  )()

// ── Évaluations (liste RH) ────────────────────────────────────────────────────
export const getCachedEvaluations = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('evaluations')
        .select('id, statut, declenchee_le, score_moyen, profile:profiles!profile_id(nom, prenoms), contrat:contrats(type_contrat, date_fin, poste)')
        .order('declenchee_le', { ascending: false })
      return data ?? []
    },
    ['evaluations-list'],
    { tags: ['evaluations'], revalidate: 300 }
  )()

// ── Congés RH (liste) ─────────────────────────────────────────────────────────
export const getCachedCongesRH = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('conges')
        .select('*, profile:profiles!profile_id(nom, prenoms, direction), type_conge:types_conge(nom)')
        .order('created_at', { ascending: false })
        .limit(200)
      return data ?? []
    },
    ['conges-rh-list'],
    { tags: ['conges'], revalidate: 120 }
  )()

// ── Profils pour signataires ───────────────────────────────────────────────────
export const getCachedProfilesForSignatures = () =>
  unstable_cache(
    async () => {
      const { data } = await service()
        .from('profiles')
        .select('id, nom, prenoms, email, role, avatar_url, type_emploi')
        .order('nom')
      return data ?? []
    },
    ['profiles-signatures'],
    { tags: ['profiles'], revalidate: 600 }
  )()
