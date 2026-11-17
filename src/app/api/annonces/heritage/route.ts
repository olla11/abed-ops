import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { getImpersonationInfo } from '@/lib/impersonation'
import { debutJourLocal } from '@/lib/badge-jours'

const DUREE_ANNONCE_MS = 7 * 24 * 60 * 60 * 1000

// Fenêtre de lancement ABED Héritage : au plus une fois par jour (heure du
// Bénin), pendant 7 jours à compter de la première fois où la personne la
// voit. Décidé ici plutôt que dans le navigateur : chaque onglet ou
// appareil a sa propre mémoire, ce qui la faisait réapparaître sans cesse.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ afficher: false })

  // Un admin qui teste un compte ne doit pas consommer l'annonce à sa place.
  if (await getImpersonationInfo()) return NextResponse.json({ afficher: false })

  const admin = createAdminClient()
  const { data: profil } = await admin.from('profiles').select('annonce_heritage_vue_le').eq('id', user.id).single()
  if (!profil) return NextResponse.json({ afficher: false })
  if (profil.annonce_heritage_vue_le && Date.now() - new Date(profil.annonce_heritage_vue_le).getTime() >= DUREE_ANNONCE_MS) {
    return NextResponse.json({ afficher: false })
  }

  // Mise à jour conditionnelle : si deux onglets demandent en même temps,
  // un seul obtient la fenêtre.
  const maintenant = new Date().toISOString()
  const { data: marque } = await admin.from('profiles')
    .update({ annonce_heritage_derniere_le: maintenant, ...(profil.annonce_heritage_vue_le ? {} : { annonce_heritage_vue_le: maintenant }) })
    .eq('id', user.id)
    .or(`annonce_heritage_derniere_le.is.null,annonce_heritage_derniere_le.lt."${debutJourLocal().toISOString()}"`)
    .select('id')

  return NextResponse.json({ afficher: (marque ?? []).length > 0 })
}
