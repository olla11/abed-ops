import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { genererAppelDeFondsPdf } from '@/lib/appel-de-fonds-pdf'

type AdminClient = ReturnType<typeof createAdminClient>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

type Resultat = { ok: true; appelDeFondsId: string; numero: string } | { ok: false; error: string }

// Regroupe les paiements Pay Roll sélectionnés par code budgétaire, génère le
// PDF de l'appel de fonds, et lance le circuit de signature DE → TG CA → PCA
// via le système générique de signature (demandes_signature/signataires),
// avec l'AAF ajouté en observateur pour recevoir automatiquement le PDF
// signé une fois le circuit bouclé (voir finalizeAfterSignature).
export async function creerAppelDeFonds(admin: AdminClient, opts: {
  payRollIds: string[]
  commentaireCaf: string | null
  createurId: string
}): Promise<Resultat> {
  const { data: items, error: itemsErr } = await admin
    .from('pay_roll').select('id, beneficiaire_nom, objet, code_budgetaire, montant, statut, appel_de_fonds_id')
    .in('id', opts.payRollIds)

  if (itemsErr || !items || items.length === 0) return { ok: false, error: 'Aucun paiement sélectionné.' }
  if (items.some(i => i.statut !== 'a_payer')) return { ok: false, error: 'Tous les paiements sélectionnés doivent être au statut « À payer ».' }
  if (items.some(i => i.appel_de_fonds_id)) return { ok: false, error: "Un des paiements sélectionnés fait déjà partie d'un appel de fonds." }
  if (items.some(i => !i.code_budgetaire)) return { ok: false, error: 'Chaque paiement doit avoir un code budgétaire renseigné.' }

  // Le circuit a besoin d'un titulaire actif pour chacun des 3 rôles — on
  // vérifie tout avant de créer quoi que ce soit, pour ne jamais laisser un
  // appel de fonds à moitié créé si l'un des trois manque.
  const [{ data: deRows }, { data: tgcaRows }, { data: pcaRows }, { data: aafRows }] = await Promise.all([
    admin.from('profiles').select('id, nom, prenoms, email').eq('role', 'de').eq('archived', false),
    admin.from('profiles').select('id, nom, prenoms, email').eq('titre', 'tresorier_ca').eq('archived', false),
    admin.from('profiles').select('id, nom, prenoms, email').eq('titre', 'president_ca').eq('archived', false),
    admin.from('profiles').select('id').eq('role', 'aaf').eq('archived', false),
  ])
  const de = (deRows ?? [])[0]
  const tgca = (tgcaRows ?? [])[0]
  const pca = (pcaRows ?? [])[0]
  if (!de) return { ok: false, error: 'Aucun Directeur Exécutif actif — impossible de lancer le circuit de signature.' }
  if (!tgca) return { ok: false, error: 'Aucun·e Trésorier·ère Général·e du CA actif·ve — impossible de lancer le circuit de signature.' }
  if (!pca) return { ok: false, error: 'Aucun·e Président·e du CA actif·ve — impossible de lancer le circuit de signature.' }

  const annee = new Date().getFullYear()

  const parCode = new Map<string, typeof items>()
  for (const it of items) {
    const arr = parCode.get(it.code_budgetaire!) ?? []
    arr.push(it)
    parCode.set(it.code_budgetaire!, arr)
  }
  const codes = [...parCode.keys()]

  const [{ data: codesInfo }, { data: budgetsCodes }, { data: budgetsTous }, { data: depenses }] = await Promise.all([
    admin.from('codes_budgetaires').select('code, libelle').in('code', codes),
    admin.from('budget_adopte').select('code_budgetaire, montant_annuel').eq('annee', annee).in('code_budgetaire', codes),
    admin.from('budget_adopte').select('montant_annuel').eq('annee', annee),
    admin.from('depenses_executees').select('code_budgetaire, montant')
      .in('code_budgetaire', codes).gte('date_paiement', `${annee}-01-01`).lte('date_paiement', `${annee}-12-31`),
  ])

  const libelleParCode = Object.fromEntries((codesInfo ?? []).map(c => [c.code, c.libelle]))
  const budgetParCode = Object.fromEntries((budgetsCodes ?? []).map(b => [b.code_budgetaire, Number(b.montant_annuel)]))
  const cumulParCode: Record<string, number> = {}
  for (const d of depenses ?? []) cumulParCode[d.code_budgetaire!] = (cumulParCode[d.code_budgetaire!] ?? 0) + Number(d.montant)
  const budgetTotalOrg = (budgetsTous ?? []).reduce((s, b) => s + Number(b.montant_annuel), 0)

  const lignes = codes.map(code => {
    const montantDemande = parCode.get(code)!.reduce((s, i) => s + Number(i.montant), 0)
    const montantPrevu = budgetParCode[code] ?? 0
    const realisationCumulee = cumulParCode[code] ?? 0
    return {
      code, libelle: libelleParCode[code] ?? code,
      montantPrevu, realisationCumulee, disponibilite: montantPrevu - realisationCumulee, montantDemande,
      commentaire: parCode.get(code)!.map(i => `${i.beneficiaire_nom} — ${i.objet}`).join(' ; '),
    }
  })
  const montantTotal = lignes.reduce((s, l) => s + l.montantDemande, 0)
  const consommationGlobalePct = budgetTotalOrg > 0 ? (montantTotal / budgetTotalOrg) * 100 : 0

  // Numérotation "NNN-AA" par année civile, comme le modèle papier fourni.
  const { count } = await admin.from('appels_de_fonds')
    .select('id', { count: 'exact', head: true })
    .gte('date_demande', `${annee}-01-01`).lte('date_demande', `${annee}-12-31`)
  const numero = `${String((count ?? 0) + 1).padStart(3, '0')}-${String(annee).slice(-2)}`
  const dateStr = new Date().toLocaleDateString('fr-FR')

  const pdfBuffer = await genererAppelDeFondsPdf({
    numero, date: dateStr, lignes: lignes.map(l => ({
      libelle: l.libelle, montantPrevu: l.montantPrevu, realisationCumulee: l.realisationCumulee,
      disponibilite: l.disponibilite, montantDemande: l.montantDemande, commentaire: l.commentaire,
    })),
    montantTotal, consommationGlobalePct,
  })

  await admin.storage.createBucket('documents', { public: false }).catch(() => {})
  const fichierNom = `Appel_de_fonds_${numero}.pdf`
  const path = `${opts.createurId}/${Date.now()}_${fichierNom}`
  const { error: uploadErr } = await admin.storage.from('documents').upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) return { ok: false, error: `Erreur lors du dépôt du PDF : ${uploadErr.message}` }

  const { data: appel, error: appelErr } = await admin.from('appels_de_fonds').insert({
    numero, date_demande: new Date().toISOString().slice(0, 10), statut: 'circuit_signature',
    commentaire_caf: opts.commentaireCaf, montant_total: montantTotal, created_by: opts.createurId,
  }).select('id').single()
  if (appelErr || !appel) return { ok: false, error: appelErr?.message ?? 'Erreur lors de la création de l\'appel de fonds.' }

  const { error: lignesErr } = await admin.from('appel_de_fonds_lignes').insert(lignes.map(l => ({
    appel_de_fonds_id: appel.id, code_budgetaire: l.code, libelle_ligne: l.libelle,
    montant_prevu: l.montantPrevu, realisation_cumulee: l.realisationCumulee,
    disponibilite: l.disponibilite, montant_demande: l.montantDemande, commentaire: l.commentaire,
  })))
  if (lignesErr) {
    await admin.from('appels_de_fonds').delete().eq('id', appel.id)
    return { ok: false, error: lignesErr.message }
  }

  await admin.from('pay_roll').update({ appel_de_fonds_id: appel.id }).in('id', opts.payRollIds)

  const { data: demande, error: demandeErr } = await admin.from('demandes_signature').insert({
    titre: `Appel de fonds N° ${numero}`,
    description: opts.commentaireCaf,
    fichier_url: path,
    createur_id: opts.createurId,
  }).select('id').single()
  if (demandeErr || !demande) return { ok: false, error: demandeErr?.message ?? 'Erreur lors de la création du circuit de signature.' }

  await admin.from('appels_de_fonds').update({ demande_signature_id: demande.id }).eq('id', appel.id)

  const sigRows = [
    { demande_id: demande.id, profile_id: de.id, ordre: 0, est_observateur: false },
    { demande_id: demande.id, profile_id: tgca.id, ordre: 1, est_observateur: false },
    { demande_id: demande.id, profile_id: pca.id, ordre: 2, est_observateur: false },
    ...(aafRows ?? []).map((a, idx) => ({ demande_id: demande.id, profile_id: a.id, ordre: 3 + idx, est_observateur: true })),
  ]
  const { error: sigErr } = await admin.from('signataires').insert(sigRows)
  if (sigErr) {
    await admin.from('demandes_signature').delete().eq('id', demande.id)
    return { ok: false, error: sigErr.message }
  }

  // Seul le premier palier (la DE, ordre 0) est notifié à la création —
  // même logique que /api/signatures/create.
  await admin.from('signataires').update({ notifie: true }).eq('demande_id', demande.id).eq('profile_id', de.id)
  await admin.from('notifications').insert({
    user_id: de.id,
    titre: 'Appel de fonds à signer',
    message: `Appel de fonds N° ${numero} — ${montantTotal.toLocaleString('fr-FR')} FCFA.`,
    lien: `/signatures/${demande.id}/signer`,
  })
  if (de.email) {
    await sendEmail({
      to: de.email,
      subject: `My ABED — Appel de fonds à signer : N° ${numero}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
          <p>Bonjour <strong>${de.prenoms} ${de.nom}</strong>,</p>
          <p>Un appel de fonds attend votre signature :</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-size:16px;font-weight:700;">Appel de fonds N° ${numero}</p>
            <p style="margin:8px 0 0;color:#6b7280;">${montantTotal.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
            Voir le document
          </a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
        </div>`,
    }).catch(e => console.error('[appel-de-fonds] email DE:', e))
  }

  return { ok: true, appelDeFondsId: appel.id, numero }
}
