export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import TdrListClient from './TdrListClient'

export type TdrLite = {
  id: string
  numero: string | null
  titre_activite: string
  projet: string | null
  periode: string | null
  statut: string
  initiateur_id: string
  initiateur: { id: string; nom: string; prenoms: string } | null
  created_at: string
  updated_at: string
  signataires: { role: string; profile_id: string | null; statut: string }[]
  collaborateurs: { profile_id: string }[]
}

export default async function TdrPage() {
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

  // RLS (tdrs_select / can_access_tdr) filtre déjà : initiateur, collaborateur,
  // signataire, admin/rh, ou TDR actif/clôturé (visible de tous).
  const { data: tdrs, error } = await supabase
    .from('tdrs')
    .select(`id, numero, titre_activite, projet, periode, statut, initiateur_id, created_at, updated_at,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms),
      signataires:tdr_signataires(role, profile_id, statut),
      collaborateurs:tdr_collaborateurs(profile_id)
    `)
    .order('created_at', { ascending: false })

  if (error) console.error('[tdr/page] fetch error:', error)

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
      <TdrListClient tdrs={(tdrs ?? []) as any as TdrLite[]} myId={user.id} />
    </>
  )
}
