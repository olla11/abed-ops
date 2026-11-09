import { NextResponse } from 'next/server'

// impersonation_info / impersonator_refresh_token (voir /api/admin/impersonate)
// et role_preview (voir /api/admin/role-preview) sont des cookies httpOnly
// indépendants de la session Supabase, avec une durée de vie de 8h — ils ne
// sont normalement effacés qu'en cliquant sur "Quitter la simulation" /
// "Revenir à mon compte". Si la session se termine autrement (déconnexion
// manuelle, inactivité, jeton expiré...) ils survivent et, à la reconnexion,
// la bannière "Connecté en tant que..." réapparaît à tort alors que personne
// n'est plus en train de simuler ou d'usurper quoi que ce soit. Appelé à
// chaque déconnexion et à chaque connexion réussie pour repartir propre.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('impersonation_info')
  res.cookies.delete('impersonator_refresh_token')
  res.cookies.delete('role_preview')
  return res
}
