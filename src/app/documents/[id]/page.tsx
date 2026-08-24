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
    .from('profiles').select('role, titre, nom, prenoms, avatar_url, type_emploi, signature_sauvegardee_b64').eq('id', user.id).single()
  const role = await getEffectiveRole(profile?.role ?? 'missionnaire')

  const { data: document } = await supabase
    .from('demandes_signature')
    .select(`id, titre, description, statut, contenu_html, created_at, updated_at, createur_id, page_hauteur_px,
      createur:profiles!demandes_signature_createur_id_fkey(id, nom, prenoms),
      participants:document_participants(id, profile_id, permission, profile:profiles!document_participants_profile_id_fkey(id, nom, prenoms))
    `)
    .eq('id', id).eq('type', 'document_collaboratif').single()

  if (!document) redirect('/documents')

  const { data: allProfiles } = await supabase
    .from('profiles_annuaire').select('id, nom, prenoms').eq('archived', false).order('prenoms')

  // Comme pour /signatures : le RLS de `profiles` masque les autres personnes
  // pour un rôle non privilégié, donc un embed peut ressortir `null` — on
  // complète via l'annuaire (qui n'est, lui, pas restreint).
  if (!document.createur && document.createur_id) {
    const { data: annuaire } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').eq('id', document.createur_id).maybeSingle()
    ;(document as any).createur = annuaire ?? null
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <DocumentDetailClient
        document={document as any}
        myId={user.id}
        allProfiles={allProfiles ?? []}
        signatureEnregistree={profile?.signature_sauvegardee_b64 ?? null}
      />
    </>
  )
}
