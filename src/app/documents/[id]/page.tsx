export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getEffectiveRole } from '@/lib/role-preview'
import { estRH, estAAF } from '@/lib/roles'
import DocumentDetailClient from './DocumentDetailClient'

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()
  const role = await getEffectiveRole(profile?.role ?? 'missionnaire')

  const { data: document } = await supabase
    .from('demandes_signature')
    .select(`id, titre, description, statut, contenu_html, fichier_url, created_at, updated_at, createur_id,
      createur:profiles!demandes_signature_createur_id_fkey(id, nom, prenoms),
      participants:document_participants(id, profile_id, permission, profile:profiles!document_participants_profile_id_fkey(id, nom, prenoms)),
      signataires(id, profile_id, email, nom_externe, signe, signe_le, est_observateur, ordre, profile:profiles!signataires_profile_id_fkey(id, nom, prenoms))
    `)
    .eq('id', id).eq('type', 'document_collaboratif').single()

  if (!document) redirect('/documents')

  const { data: allProfiles } = await supabase
    .from('profiles_annuaire').select('id, nom, prenoms').eq('archived', false).order('prenoms')

  // Comme pour /signatures : le RLS de `profiles` masque les autres personnes
  // pour un rôle non privilégié, donc un embed peut ressortir `null` — on
  // complète via l'annuaire (qui n'est, lui, pas restreint).
  {
    const doc = document as unknown as { createur: { id: string } | null; createur_id: string; signataires: { profile_id: string | null; profile: unknown }[] }
    const ids = new Set<string>()
    if (doc.createur_id) ids.add(doc.createur_id)
    for (const s of doc.signataires ?? []) if (s.profile_id) ids.add(s.profile_id)
    if (ids.size > 0) {
      const { data: annuaire } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').in('id', [...ids])
      const parId = new Map((annuaire ?? []).map(p => [p.id, p]))
      if (!doc.createur && doc.createur_id) (doc as any).createur = parId.get(doc.createur_id) ?? null
      for (const s of doc.signataires ?? []) if (!s.profile && s.profile_id) (s as any).profile = parId.get(s.profile_id) ?? null
    }
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <DocumentDetailClient document={document as any} myId={user.id} allProfiles={allProfiles ?? []} />
    </>
  )
}
