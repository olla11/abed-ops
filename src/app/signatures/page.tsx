export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getCachedProfilesForSignatures } from '@/lib/cache'
import SignaturesClient from './SignaturesClient'

export type SignataireRow = {
  profile_id: string | null
  email: string | null
  nom_externe: string | null
  signe: boolean
  signe_le: string | null
  refuse: boolean
  refuse_le: string | null
  refuse_motif: string | null
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

  const [{ data: demandes }, profiles] = await Promise.all([
    supabase
      .from('demandes_signature')
      .select(`
        id, titre, description, fichier_url, statut, created_at, createur_id,
        createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
        signataires(profile_id, email, nom_externe, signe, signe_le, refuse, refuse_le, refuse_motif, profile:profiles!signataires_profile_id_fkey(nom, prenoms))
      `)
      .order('created_at', { ascending: false }),
    getCachedProfilesForSignatures(),
  ])

  const allDemandes = (demandes ?? []) as unknown as DemandeRow[]

  // Comme pour les TDR : le RLS de `profiles` masque les autres personnes
  // pour un rôle non privilégié, donc le créateur ou un co-signataire peut
  // ressortir `null` du embed ci-dessus. On complète via l'annuaire.
  {
    const idsReferences = new Set<string>()
    for (const d of allDemandes) {
      if (d.createur_id) idsReferences.add(d.createur_id)
      for (const s of d.signataires ?? []) if (s.profile_id) idsReferences.add(s.profile_id)
    }
    if (idsReferences.size > 0) {
      const { data: annuaire } = await supabase
        .from('profiles_annuaire').select('id, nom, prenoms').in('id', [...idsReferences])
      const parId = new Map((annuaire ?? []).map(p => [p.id, p]))
      for (const d of allDemandes) {
        if (!d.createur && d.createur_id) d.createur = parId.get(d.createur_id) ?? null
        for (const s of d.signataires ?? []) if (!s.profile && s.profile_id) s.profile = parId.get(s.profile_id) ?? null
      }
    }
  }

  // Les demandes liées à un contrat (titre généré automatiquement par le RH) sont
  // gérées dans "Contrats à signer" (Mon espace > Mes contrats), pas ici.
  const CONTRAT_TITRE_RE = /^(Contrat|Convention|Avenant|Offre de stage) .* — /

  // Requests where current user is a signatory and hasn't signed yet
  const mesDemandesASign = allDemandes.filter(d =>
    d.statut === 'en_attente' &&
    d.signataires?.some(s => s.profile_id === user.id && !s.signe) &&
    !CONTRAT_TITRE_RE.test(d.titre)
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
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
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
