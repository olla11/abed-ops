export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import RessourcesClient from './RessourcesClient'

export type Ressource = {
  id: string
  categorie: 'guide' | 'rapport' | 'lien_usuel' | 'publication'
  titre: string
  url: string
  description: string | null
  sous_categorie: string | null
  ordre: number
  created_at: string
}

export default async function RessourcesPage() {
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
  const isManager = ['rh', 'admin'].includes(realRole) && !previewRole

  const admin = createAdminClient()
  const { data: ressources, error: ressourcesErr } = await admin
    .from('ressources')
    .select('id, categorie, titre, url, description, sous_categorie, ordre, created_at')
    .order('categorie', { ascending: true })
    .order('ordre', { ascending: true })

  if (ressourcesErr) console.error('[ressources/page] fetch error:', ressourcesErr)

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
      <RessourcesClient ressources={(ressources ?? []) as Ressource[]} isManager={isManager} />
    </>
  )
}
