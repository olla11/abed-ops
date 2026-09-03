export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { getCachedProfilesForSignatures } from '@/lib/cache'
import SignaturesClient from './SignaturesClient'
import { estRH, estAAF } from '@/lib/roles'

export type SignataireRow = {
  profile_id: string | null
  email: string | null
  nom_externe: string | null
  signe: boolean
  signe_le: string | null
  refuse: boolean
  refuse_le: string | null
  refuse_motif: string | null
  est_observateur: boolean
  profile: { nom: string; prenoms: string } | null
}

export type DemandeRow = {
  id: string
  titre: string
  description: string | null
  fichier_url: string | null
  statut: string
  type?: string
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
    .select('role, titre, nom, prenoms, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  const [{ data: demandes }, profiles] = await Promise.all([
    supabase
      .from('demandes_signature')
      .select(`
        id, titre, description, fichier_url, statut, type, created_at, createur_id,
        createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
        signataires(profile_id, email, nom_externe, signe, signe_le, refuse, refuse_le, refuse_motif, est_observateur, profile:profiles!signataires_profile_id_fkey(nom, prenoms))
      `)
      .order('created_at', { ascending: false }),
    getCachedProfilesForSignatures(),
  ])

  // Les documents en révision collaborative (module "Documents") n'ont pas
  // encore de fichier_url/signataires tant qu'ils n'ont pas été verrouillés
  // pour signature — ils ne doivent apparaître ici qu'une fois basculés dans
  // le circuit de signature (statut en_attente/complete/refusee), pas
  // pendant leur rédaction (brouillon/revision), où /documents est la seule
  // vue pertinente.
  const allDemandes = ((demandes ?? []) as unknown as DemandeRow[])
    .filter(d => d.type !== 'document_collaboratif' || !['brouillon', 'revision'].includes(d.statut))

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

  // Les demandes liées à un contrat/document RH (titre généré
  // automatiquement) sont gérées dans "Contrats à signer" (Mon espace >
  // Mes contrats), pas ici : Contrat/Convention/Avenant deviennent
  // actionnables une fois envoyés au signataire (contrats.signataire_id,
  // action RH "envoyer_signataire") ; une Offre (de stage ou non) y est
  // actionnable dès la création (le DE signe en premier) — voir
  // contrat-creation.ts, qui renseigne directement signataire_id pour ce cas
  // au lieu de passer par ce système générique de demandes_signature.
  const CONTRAT_TITRE_RE = /^(Contrat|Convention|Avenant|Offre|Offre de stage) .* — /

  // Requests where current user is a signatory and hasn't signed yet
  const mesDemandesASign = allDemandes.filter(d =>
    d.statut === 'en_attente' &&
    d.signataires?.some(s => s.profile_id === user.id && !s.signe && !s.est_observateur) &&
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
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
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
