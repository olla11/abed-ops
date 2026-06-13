import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const myRole = me?.role ?? ''

  const body = await req.json()
  const { action, commentaire } = body

  if (!['approuver', 'rejeter'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conge } = await service
    .from('conges')
    .select('*, profile:profiles!profile_id(nom, prenoms)')
    .eq('id', id)
    .single()

  if (!conge) return NextResponse.json({ error: 'Congé introuvable' }, { status: 404 })

  let newStatut: string
  let notifUserId: string | null = null
  let notifTitre = ''
  let notifMessage = ''

  const nomEmploye = `${(conge.profile as any)?.prenoms ?? ''} ${(conge.profile as any)?.nom ?? ''}`.trim()

  if (action === 'rejeter') {
    newStatut = 'rejete'
    notifUserId = conge.profile_id
    notifTitre = 'Demande de congé rejetée'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}) a été rejetée.${commentaire ? ` Motif : ${commentaire}` : ''}`
  } else if (conge.statut === 'en_attente' && (conge.valideur_n1_id === user.id || ['rh', 'admin'].includes(myRole))) {
    newStatut = 'approuve_n1'
    const { data: rhUsers } = await service.from('profiles').select('id').in('role', ['rh', 'admin'])
    for (const rh of rhUsers ?? []) {
      await service.from('notifications').insert({
        user_id: rh.id,
        titre: 'Congé — validation finale requise',
        message: `La demande de congé de ${nomEmploye} (${conge.nb_jours}j) a été approuvée par le responsable N1. Validation finale requise.`,
        lien: '/rh/conges',
      })
    }
    notifUserId = conge.profile_id
    notifTitre = 'Congé approuvé (N1)'
    notifMessage = `Votre demande de congé a été approuvée par votre responsable. En attente de validation RH.`
  } else if (conge.statut === 'approuve_n1' && ['rh', 'admin'].includes(myRole)) {
    newStatut = 'approuve'
    notifUserId = conge.profile_id
    notifTitre = 'Congé approuvé'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}, ${conge.nb_jours} jours) a été approuvée.`
  } else {
    return NextResponse.json({ error: 'Action non autorisée à cette étape' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    statut: newStatut,
    commentaire_valideur: commentaire || null,
    updated_at: new Date().toISOString(),
  }
  if (newStatut === 'approuve') updates.valideur_final_id = user.id

  const { data: updated, error } = await service.from('conges').update(updates).eq('id', id).select('*, type_conge:types_conge(nom)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (notifUserId && notifTitre) {
    await service.from('notifications').insert({
      user_id: notifUserId, titre: notifTitre, message: notifMessage, lien: '/conges',
    })
  }

  if (newStatut === 'approuve' && conge.type_conge_id) {
    const year = new Date().getFullYear()
    await service.from('soldes_conges').upsert({
      profile_id: conge.profile_id,
      type_conge_id: conge.type_conge_id,
      annee: year,
      jours_acquis: 30,
      jours_pris: conge.nb_jours ?? 0,
    }, { onConflict: 'profile_id,type_conge_id,annee', ignoreDuplicates: false })
  }

  return NextResponse.json({ conge: updated })
}
