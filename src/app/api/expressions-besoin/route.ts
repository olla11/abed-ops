import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'
import { autoSkipExpressionBesoin } from '@/lib/circuit-vacancy'

const LigneSchema = z.object({
  designation:    z.string().min(1, 'Désignation requise').max(300),
  quantite:       z.string().max(50).optional().default(''),
  montant_estime: s.montant,
  reference:      z.string().max(300).optional().default(''),
})

const ExpressionBesoinSchema = z.object({
  projet_service:   z.string().min(1, 'Projet / service requis').max(200),
  nature_depense:   z.string().min(1, 'Nature de la dépense requise').max(200),
  code_budgetaire:  z.string().min(1, 'Code budgétaire requis').max(100),
  ref_tdr:          z.string().max(200).optional(),
  lignes:           z.array(LigneSchema).min(1, 'Au moins une ligne de besoin requise').max(20),
})

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isTraiteur = ['aaf', 'caf', 'de', 'admin'].includes(role)

  let query = supabase
    .from('expressions_besoin')
    .select('*, demandeur:profiles!expressions_besoin_demandeur_id_fkey(nom,prenoms,email)')
    .order('created_at', { ascending: false })

  if (!isTraiteur) query = query.eq('demandeur_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  // Par utilisateur, pas par IP — sinon tout un bureau derrière la même IP
  // publique partage un seul quota (voir ProjetDetailClient.tsx).
  const limited = rateLimit(req, { limit: 10, window: 60 }, user.id)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const v = validate(ExpressionBesoinSchema, body)
  if ('error' in v) return v.error

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('nom, prenoms, fonction, telephone, email').eq('id', user.id).single()

  const nomDemandeur = `${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`.trim()
  const montant_total = v.data.lignes.reduce((sum, l) => sum + l.montant_estime, 0)

  // Numéro officiel : {séquence 3 chiffres}-{année sur 2 chiffres}/ABED-ONG/DE/CAF/AAF,
  // même schéma que les bons de commande (bon-de-commande.ts) — comptage via
  // le client service-role pour un compteur global, pas par demandeur.
  const now = new Date()
  const year = now.getFullYear()
  const { count } = await admin.from('expressions_besoin')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
    .lt('created_at', `${year + 1}-01-01`)
  const numero = `${String((count ?? 0) + 1).padStart(3, '0')}-${String(year).slice(2)}/ABED-ONG/DE/CAF/AAF`

  const { data, error } = await supabase.from('expressions_besoin').insert({
    demandeur_id: user.id,
    numero,
    nom_demandeur: nomDemandeur,
    fonction: profile?.fonction ?? null,
    contact: profile?.telephone ?? null,
    projet_service: v.data.projet_service,
    nature_depense: v.data.nature_depense,
    code_budgetaire: v.data.code_budgetaire,
    ref_tdr: v.data.ref_tdr || null,
    lignes: v.data.lignes,
    montant_total,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Si aucun compte AAF (ni CAF, qui en hérite les droits) n'est actif,
  // fait sauter automatiquement l'étape plutôt que de bloquer la demande.
  await autoSkipExpressionBesoin(admin, data.id).catch(e => console.error('[autoSkipExpressionBesoin]:', e))

  const { data: apresSaut } = await admin.from('expressions_besoin').select('status').eq('id', data.id).single()
  if (apresSaut?.status !== 'soumis') {
    return NextResponse.json({ ok: true, id: data.id, numero: data.numero })
  }

  // Notifier les AAF/CAF — client service-role : le demandeur ne peut ni
  // lister les profils AAF ni insérer une notification pour quelqu'un d'autre.
  const { data: aafs } = await admin.from('profiles').select('id, email, prenoms, nom').in('role', ['aaf', 'caf'])
  for (const aaf of aafs ?? []) {
    await admin.from('notifications').insert({
      user_id: aaf.id,
      titre: 'Nouvelle expression de besoin',
      message: `${nomDemandeur} — ${v.data.projet_service} — ${montant_total.toLocaleString('fr-FR')} FCFA`,
      lien: '/aaf/besoins',
    })
    if (aaf.email) {
      try {
        await sendEmail({
          to: aaf.email,
          subject: '[ABED-ONG] Nouvelle expression de besoin à traiter',
          html: buildEmailAAF({ nomDemandeur, projetService: v.data.projet_service, montant: montant_total, aafNom: `${aaf.prenoms} ${aaf.nom}` }),
        })
      } catch (e) { console.error('[Email] AAF notif:', e) }
    }
  }

  return NextResponse.json({ ok: true, id: data.id, numero: data.numero })
}

function buildEmailAAF({ nomDemandeur, projetService, montant, aafNom }: { nomDemandeur: string; projetService: string; montant: number; aafNom: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#166534;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Expression de besoin en attente</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${aafNom}</strong>,</p>
      <p>Une nouvelle expression de besoin attend votre validation.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Demandeur</td><td>${nomDemandeur}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Projet / Service</td><td>${projetService}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant estimé</td><td><strong>${montant.toLocaleString('fr-FR')} FCFA</strong></td></tr>
      </table>
      <a href="${appUrl}/aaf/besoins" style="display:inline-block;background:#166534;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">
        Traiter la demande →
      </a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}
