import type { SupabaseClient } from '@supabase/supabase-js'

const ROLE_VERS_TITRE: Record<string, string> = {
  caf: 'caf',
  rh: 'rh',
  aaf: 'aaf',
  de: 'directeur_executif',
  dp: 'directeur_programmes',
}

// Retourne le titulaire "officiel" d'un rôle à titre unique (CAF, DE, DP, RH,
// AAF) : le principal désigné dans titres_principaux s'il y a doublon,
// sinon le titulaire actif le plus ancien. À utiliser partout où le système
// doit choisir UN destinataire/signataire pour ce rôle (assignation à la
// création d'un TDR, notification ponctuelle) au lieu d'en prendre un au
// hasard parmi plusieurs comptes qui partagent le même rôle.
export async function getTitulaireOfficiel(
  admin: SupabaseClient,
  role: string
): Promise<{ id: string } | null> {
  const titre = ROLE_VERS_TITRE[role]
  if (titre) {
    const { data: principal } = await admin
      .from('titres_principaux').select('profile_id_principal').eq('titre', titre).maybeSingle()
    if (principal?.profile_id_principal) {
      const { data: profil } = await admin
        .from('profiles').select('id').eq('id', principal.profile_id_principal).eq('archived', false).maybeSingle()
      if (profil) return profil
    }
  }

  const { data: fallback } = await admin
    .from('profiles').select('id').eq('role', role).eq('archived', false)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  return fallback
}
