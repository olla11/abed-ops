import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { getImpersonationInfo } from '@/lib/impersonation'

const DUREE_ANNONCE_MS = 7 * 24 * 60 * 60 * 1000

// Fenêtre de lancement ABED Héritage : montrée à chaque connexion pendant 7
// jours à compter de la première fois où la personne la voit (et non d'une
// date fixe — le déploiement est manuel, la date de mise en ligne inconnue).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ afficher: false })

  // Un admin qui teste un compte ne doit pas démarrer les 7 jours à sa place.
  if (await getImpersonationInfo()) return NextResponse.json({ afficher: false })

  const admin = createAdminClient()
  const { data: profil } = await admin.from('profiles').select('annonce_heritage_vue_le').eq('id', user.id).single()
  if (!profil) return NextResponse.json({ afficher: false })

  if (!profil.annonce_heritage_vue_le) {
    await admin.from('profiles').update({ annonce_heritage_vue_le: new Date().toISOString() }).eq('id', user.id)
    return NextResponse.json({ afficher: true })
  }

  const afficher = Date.now() - new Date(profil.annonce_heritage_vue_le).getTime() < DUREE_ANNONCE_MS
  return NextResponse.json({ afficher })
}
