export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import SignaturesClient from './SignaturesClient'

export type SignataireRow = {
  profile_id: string
  signe: boolean
  signe_le: string | null
  profile: { nom: string; prenoms: string } | null
}

export type DemandeRow = {
  id: string
  titre: string
  description: string | null
  fichier_url: string | null
  statut: string
  created_at: string
  createur_id: string
  createur: { nom: string; prenoms: string } | null
  signataires: SignataireRow[]
}

export type ProfileOption = {
  id: string
  nom: string
  prenoms: string
  email: string
  role: string | null
  avatar_url: string | null
  type_emploi: string | null
}

export default async function SignaturesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  const [{ data: demandes }, { data: profiles }] = await Promise.all([
    supabase
      .from('demandes_signature')
      .select(`
        id, titre, description, fichier_url, statut, created_at, createur_id,
        createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
        signataires(profile_id, signe, signe_le, profile:profiles!signataires_profile_id_fkey(nom, prenoms))
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nom, prenoms, email, role, avatar_url, type_emploi')
      .order('nom', { ascending: true }),
  ])

  const allDemandes = (demandes ?? []) as unknown as DemandeRow[]

  // Requests where current user is a signatory and hasn't signed yet
  const mesDemandesASign = allDemandes.filter(d =>
    d.statut === 'en_attente' &&
    d.signataires?.some(s => s.profile_id === user.id && !s.signe)
  )

  // Requests created by current user
  const mesCreations = allDemandes.filter(d => d.createur_id === user.id)

  // All completed requests (visible to all)
  const toutesSignees = allDemandes.filter(d => d.statut === 'complete')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <SignaturesClient
          userId={user.id}
          mesDemandesASign={mesDemandesASign}
          mesCreations={mesCreations}
          toutesSignees={toutesSignees}
          profiles={(profiles ?? []) as ProfileOption[]}
        />
    </>
  )
}
