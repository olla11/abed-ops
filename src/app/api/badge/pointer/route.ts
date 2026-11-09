import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { distanceMetres } from '@/lib/geo'
import { memeVisage } from '@/lib/face-server'
import { debutJourLocal, heureLocaleMinutes } from '@/lib/badge-jours'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEURE_LIMITE_ENTREE = 9 * 60 // 9h00 — au-delà, une entrée doit être justifiée
const HEURE_LIMITE_SORTIE = 17 * 60 // 17h00 — avant, une sortie doit être justifiée

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const limited = rateLimit(req, { limit: 20, window: 60 }, user.id)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)
  const accuracy = body?.accuracy != null ? Number(body.accuracy) : null
  const deviceId = body?.deviceId
  const descriptor: number[] | undefined = Array.isArray(body?.descriptor) ? body.descriptor : undefined
  const justification = typeof body?.justification === 'string' ? body.justification.trim().slice(0, 500) : ''

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Position GPS invalide' }, { status: 400 })
  }
  if (typeof deviceId !== 'string' || !UUID_RE.test(deviceId)) {
    return NextResponse.json({ error: 'Identifiant d\'appareil invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Strictement 2 pointages réussis par jour (1 entrée + 1 sortie) — pas de
  // pause déjeuner ni d'allers-retours multiples. Vérifié avant tout le
  // reste (GPS, caméra) pour ne pas faire travailler l'utilisateur pour
  // rien si sa journée est déjà complète.
  const debutJourVerif = debutJourLocal()
  const { data: pointagesDuJour } = await admin.from('badge_pointages')
    .select('type').eq('profile_id', user.id).eq('statut', 'reussi')
    .gte('horodatage', debutJourVerif.toISOString())
  const aDejaBadgeEntree = (pointagesDuJour ?? []).some(p => p.type === 'entree')
  const aDejaBadgeSortie = (pointagesDuJour ?? []).some(p => p.type === 'sortie')
  if (aDejaBadgeEntree && aDejaBadgeSortie) {
    return NextResponse.json({ error: 'Vous avez déjà badgé votre entrée et votre sortie aujourd\'hui.' }, { status: 400 })
  }

  // Référentiel du bureau — configurable par un admin, jamais codé en dur
  // (voir /api/admin/badge-parametres).
  const { data: params } = await admin.from('parametres').select('cle, valeur')
    .in('cle', ['badge_bureau_latitude', 'badge_bureau_longitude', 'badge_rayon_metres'])
  const map = Object.fromEntries((params ?? []).map(p => [p.cle, p.valeur]))
  const bureauLat = Number(map.badge_bureau_latitude)
  const bureauLng = Number(map.badge_bureau_longitude)
  const rayon = Number(map.badge_rayon_metres) || 50
  if (!Number.isFinite(bureauLat) || !Number.isFinite(bureauLng)) {
    return NextResponse.json({ error: 'Position du bureau non configurée — contactez un administrateur.' }, { status: 500 })
  }

  const distance = distanceMetres(latitude, longitude, bureauLat, bureauLng)

  // Entrée si pas encore badgée aujourd'hui, sinon forcément sortie (le cas
  // "les deux déjà faites" a été écarté juste au-dessus).
  const type: 'entree' | 'sortie' = aDejaBadgeEntree ? 'sortie' : 'entree'

  const basePointage = {
    profile_id: user.id, type, latitude, longitude, precision_m: accuracy,
    distance_bureau_m: Math.round(distance), device_id: deviceId,
    justification: justification || null,
  }

  if (distance > rayon) {
    await admin.from('badge_pointages').insert({ ...basePointage, statut: 'hors_perimetre', verification_faciale_effectuee: false })
    return NextResponse.json({
      error: `Vous êtes à ${Math.round(distance)} m du bureau (maximum autorisé : ${rayon} m). Rapprochez-vous et réessayez.`,
    }, { status: 403 })
  }

  // Entrée après 9h ou sortie avant 17h : justification obligatoire avant
  // d'enregistrer quoi que ce soit — bloquant, vérifié avant la vérification
  // d'appareil/visage pour ne réclamer la caméra qu'une fois la justification
  // acquise.
  const minutes = heureLocaleMinutes()
  const justificationRequise =
    (type === 'entree' && minutes > HEURE_LIMITE_ENTREE) ||
    (type === 'sortie' && minutes < HEURE_LIMITE_SORTIE)
  if (justificationRequise && !justification) {
    return NextResponse.json({ needsJustification: true, type })
  }

  const { data: appareilConnu } = await admin.from('badge_appareils_connus')
    .select('device_id').eq('profile_id', user.id).maybeSingle()

  const appareilReconnu = appareilConnu?.device_id === deviceId

  if (!appareilReconnu) {
    if (!descriptor) {
      // Pas encore de selfie fourni — le client doit lancer la vérification
      // faciale avant de rappeler cette route. Rien n'est enregistré ici.
      return NextResponse.json({ needsFaceVerification: true, distance: Math.round(distance) })
    }

    const { data: profil } = await admin.from('profiles').select('face_descriptor').eq('id', user.id).single()
    const reference = profil?.face_descriptor as number[] | null
    if (!reference || reference.length !== 128) {
      return NextResponse.json({ error: 'Photo de référence non configurée — rendez-vous sur votre profil pour l\'ajouter.' }, { status: 400 })
    }

    if (!memeVisage(descriptor, reference)) {
      await admin.from('badge_pointages').insert({ ...basePointage, statut: 'echec_facial', verification_faciale_effectuee: true })
      return NextResponse.json({ error: 'Visage non reconnu. Réessayez avec un meilleur éclairage, ou contactez les RH.' }, { status: 403 })
    }

    await admin.from('badge_appareils_connus').upsert(
      { profile_id: user.id, device_id: deviceId, derniere_utilisation: new Date().toISOString() },
      { onConflict: 'profile_id' }
    )
  }

  const { data: inserted, error: insErr } = await admin.from('badge_pointages')
    .insert({ ...basePointage, statut: 'reussi', verification_faciale_effectuee: !appareilReconnu })
    .select('id, type, horodatage').single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  // Entrée tardive après que le cron du soir ait déjà marqué la journée
  // "non_badge" (cas rare mais possible) — le marqueur automatique n'a plus
  // lieu d'être une fois un vrai badgeage enregistré pour ce jour.
  if (type === 'entree') {
    await admin.from('badge_pointages').delete()
      .eq('profile_id', user.id).eq('type', 'entree').eq('statut', 'non_badge')
      .gte('horodatage', debutJourVerif.toISOString())
  }

  return NextResponse.json({ ok: true, pointage: inserted })
}
