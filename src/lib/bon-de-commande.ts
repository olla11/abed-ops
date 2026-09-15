import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { accordGenre } from '@/lib/genre'
import { genererBonDeCommandePdf, type BonDeCommandeLignePdf } from '@/lib/bon-de-commande-pdf'

type AdminClient = ReturnType<typeof createAdminClient>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

// Seuil du modèle papier fourni : en-dessous, le DE seul signe ; à partir de
// ce montant, la décision remonte au PCA.
export const SEUIL_SIGNATURE_PCA = 3_000_000

type Resultat = { ok: true; bonDeCommandeId: string; numero: string } | { ok: false; error: string }

export type LigneBonDeCommandeInput = { jour: string; designation: string; quantite: number; prixUnitaire: number }
export type ReferenceBonDeCommandeInput = { id: string; label: string }

// Génère le PDF du bon de commande à l'état 'brouillon' — l'AAF le
// prévisualise avant de décider de l'envoyer en signature (DE ou PCA selon
// le montant, voir envoyerBonDeCommandeCircuit) ou de l'annuler.
export async function genererBonDeCommandeBrouillon(admin: AdminClient, opts: {
  fournisseurNom: string
  fournisseurRccm: string | null
  fournisseurIfu: string | null
  fournisseurTelephone: string | null
  objet: string
  dateLivraisonSouhaitee: string | null
  codeBudgetaire: string | null
  referenceType: 'tdr' | 'contrat' | 'expression_besoin' | null
  references: ReferenceBonDeCommandeInput[]
  lignes: LigneBonDeCommandeInput[]
  createurId: string
}): Promise<Resultat> {
  if (!opts.fournisseurNom.trim()) return { ok: false, error: 'Le nom du fournisseur est requis.' }
  if (!opts.objet.trim()) return { ok: false, error: "L'objet est requis." }
  if (opts.lignes.length === 0) return { ok: false, error: 'Ajoutez au moins une ligne.' }
  if (opts.lignes.some(l => !l.designation.trim() || l.quantite <= 0 || l.prixUnitaire < 0)) {
    return { ok: false, error: 'Chaque ligne doit avoir une désignation, une quantité positive et un prix unitaire valide.' }
  }

  const lignesPdf: BonDeCommandeLignePdf[] = opts.lignes.map(l => ({
    jour: l.jour, designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire,
    montant: l.quantite * l.prixUnitaire,
  }))
  const montantTotal = lignesPdf.reduce((s, l) => s + l.montant, 0)
  const signataireRole: 'de' | 'pca' = montantTotal < SEUIL_SIGNATURE_PCA ? 'de' : 'pca'

  const annee = new Date().getFullYear()
  const { count } = await admin.from('bons_de_commande')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${annee}-01-01`).lte('created_at', `${annee}-12-31`)
  const numero = `BC${String((count ?? 0) + 1).padStart(3, '0')}-${String(annee).slice(-2)}/ABED/DE/CAF/AAF`
  const dateStr = new Date().toLocaleDateString('fr-FR')

  const [{ data: deRows }, { data: pcaRows }, { data: codeInfo }] = await Promise.all([
    admin.from('profiles').select('civilite').eq('role', 'de').eq('archived', false).limit(1),
    admin.from('profiles').select('civilite').eq('titre', 'president_ca').eq('archived', false).limit(1),
    opts.codeBudgetaire ? admin.from('codes_budgetaires').select('code, libelle').eq('code', opts.codeBudgetaire).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const signataireTitre = signataireRole === 'de'
    ? accordGenre((deRows ?? [])[0]?.civilite, 'Le Directeur Exécutif', 'La Directrice Exécutive')
    : accordGenre((pcaRows ?? [])[0]?.civilite, 'Le Président du Conseil d\'Administration', 'La Présidente du Conseil d\'Administration')

  const REFERENCE_TYPE_LABELS: Record<string, string> = {
    tdr: 'TDR', contrat: 'Contrat', expression_besoin: 'Expression de besoin',
  }

  const pdfBuffer = await genererBonDeCommandePdf({
    numero, date: dateStr,
    fournisseurNom: opts.fournisseurNom, fournisseurRccm: opts.fournisseurRccm,
    fournisseurIfu: opts.fournisseurIfu, fournisseurTelephone: opts.fournisseurTelephone,
    objet: opts.objet, lignes: lignesPdf, montantTotal,
    dateLivraisonSouhaitee: opts.dateLivraisonSouhaitee, signataireTitre,
    codeBudgetaire: codeInfo ? `${codeInfo.code} — ${codeInfo.libelle}` : null,
    referenceLabel: opts.referenceType && opts.references.length > 0
      ? `${REFERENCE_TYPE_LABELS[opts.referenceType]} : ${opts.references.map(r => r.label).join(' ; ')}`
      : null,
  })

  await admin.storage.createBucket('documents', { public: false }).catch(() => {})
  const fichierNom = `Bon_de_commande_${numero.split('/')[0]}.pdf`
  const path = `${opts.createurId}/${Date.now()}_${fichierNom}`
  const { error: uploadErr } = await admin.storage.from('documents').upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) return { ok: false, error: `Erreur lors du dépôt du PDF : ${uploadErr.message}` }

  const { data: bc, error: bcErr } = await admin.from('bons_de_commande').insert({
    numero, statut: 'brouillon', fichier_url: path,
    fournisseur_nom: opts.fournisseurNom, fournisseur_rccm: opts.fournisseurRccm,
    fournisseur_ifu: opts.fournisseurIfu, fournisseur_telephone: opts.fournisseurTelephone,
    objet: opts.objet, date_livraison_souhaitee: opts.dateLivraisonSouhaitee,
    code_budgetaire: opts.codeBudgetaire, reference_type: opts.referenceType,
    montant_total: montantTotal, signataire_role: signataireRole, created_by: opts.createurId,
  }).select('id').single()
  if (bcErr || !bc) return { ok: false, error: bcErr?.message ?? 'Erreur lors de la création du bon de commande.' }

  const { error: lignesErr } = await admin.from('bon_de_commande_lignes').insert(
    opts.lignes.map((l, i) => ({
      bon_de_commande_id: bc.id, jour: l.jour, designation: l.designation,
      quantite: l.quantite, prix_unitaire: l.prixUnitaire, montant: l.quantite * l.prixUnitaire, ordre: i,
    }))
  )
  if (lignesErr) {
    await admin.from('bons_de_commande').delete().eq('id', bc.id)
    return { ok: false, error: lignesErr.message }
  }

  if (opts.references.length > 0) {
    const { error: refErr } = await admin.from('bon_de_commande_references').insert(
      opts.references.map(r => ({ bon_de_commande_id: bc.id, reference_id: r.id, reference_label: r.label }))
    )
    if (refErr) {
      await admin.from('bons_de_commande').delete().eq('id', bc.id)
      return { ok: false, error: refErr.message }
    }
  }

  return { ok: true, bonDeCommandeId: bc.id, numero }
}

// Annule un bon de commande encore à l'état 'brouillon' — jamais envoyé en
// signature — pour laisser l'AAF corriger après prévisualisation.
export async function annulerBonDeCommandeBrouillon(admin: AdminClient, bonDeCommandeId: string): Promise<Resultat> {
  const { data: bc } = await admin.from('bons_de_commande').select('id, statut, fichier_url').eq('id', bonDeCommandeId).single()
  if (!bc) return { ok: false, error: 'Bon de commande introuvable.' }
  if (bc.statut !== 'brouillon') return { ok: false, error: 'Ce bon de commande a déjà été envoyé en signature.' }

  if (bc.fichier_url) await admin.storage.from('documents').remove([bc.fichier_url]).catch(() => {})
  await admin.from('bon_de_commande_lignes').delete().eq('bon_de_commande_id', bonDeCommandeId)
  await admin.from('bons_de_commande').delete().eq('id', bonDeCommandeId)

  return { ok: true, bonDeCommandeId, numero: '' }
}

// Retire un bon de commande déjà envoyé en signature (statut
// 'circuit_signature') mais pas encore signé par le DE/PCA — le supprime
// totalement du système (document, lignes, références, circuit de
// signature) plutôt que de le laisser traîner rejeté. Une fois signé, le
// statut passe à 'signe' (voir finalizeAfterSignature) et ce retrait n'est
// plus proposé : l'engagement est déjà pris.
export async function retirerBonDeCommandeEnCircuit(admin: AdminClient, bonDeCommandeId: string): Promise<Resultat> {
  const { data: bc } = await admin.from('bons_de_commande')
    .select('id, numero, statut, fichier_url, demande_signature_id').eq('id', bonDeCommandeId).single()
  if (!bc) return { ok: false, error: 'Bon de commande introuvable.' }
  if (bc.statut === 'brouillon') return { ok: false, error: "Ce bon de commande n'a pas encore été envoyé en signature — utilisez l'annulation du brouillon." }
  if (bc.statut !== 'circuit_signature') return { ok: false, error: 'Ce bon de commande est déjà signé — impossible de le retirer.' }

  // Notifie le signataire désigné (DE ou PCA) avant suppression, pour qu'il
  // ne se retrouve pas face à un lien mort dans ses signatures en attente.
  if (bc.demande_signature_id) {
    const { data: signataire } = await admin
      .from('signataires').select('profile_id, profile:profiles!profile_id(email, nom, prenoms)')
      .eq('demande_id', bc.demande_signature_id).eq('signe', false).maybeSingle()
    const p = signataire?.profile as unknown as { email: string | null; nom: string; prenoms: string } | { email: string | null; nom: string; prenoms: string }[] | null
    const profil = Array.isArray(p) ? p[0] : p
    if (signataire?.profile_id) {
      await admin.from('notifications').insert({
        user_id: signataire.profile_id,
        titre: 'Bon de commande retiré',
        message: `Le bon de commande N° ${bc.numero} a été retiré par l'AAF — plus besoin de le signer.`,
      })
    }
    if (profil?.email) {
      await sendEmail({
        to: profil.email,
        subject: `My ABED — Bon de commande retiré : N° ${bc.numero}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#991b1b;">My ABED — Document retiré</h2>
          <p>Bonjour <strong>${profil.prenoms} ${profil.nom}</strong>,</p>
          <p>Le bon de commande N° ${bc.numero} a été retiré par l'AAF avant votre signature — vous n'avez plus rien à faire.</p>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
        </div>`,
      }).catch(e => console.error('[bon-de-commande] email retrait signataire:', e))
    }
  }

  if (bc.fichier_url) await admin.storage.from('documents').remove([bc.fichier_url]).catch(() => {})
  await admin.from('bon_de_commande_lignes').delete().eq('bon_de_commande_id', bonDeCommandeId)
  await admin.from('bon_de_commande_references').delete().eq('bon_de_commande_id', bonDeCommandeId)
  await admin.from('bons_de_commande').delete().eq('id', bonDeCommandeId)
  if (bc.demande_signature_id) await admin.from('demandes_signature').delete().eq('id', bc.demande_signature_id)

  return { ok: true, bonDeCommandeId, numero: bc.numero }
}

// Une fois le brouillon validé par l'AAF, envoie le document en signature au
// DE ou au PCA (déterminé à la génération, selon le montant) via le système
// générique de signature — un seul signataire, pas de circuit à étapes.
export async function envoyerBonDeCommandeCircuit(admin: AdminClient, opts: {
  bonDeCommandeId: string
  createurId: string
}): Promise<Resultat> {
  const { data: bc } = await admin.from('bons_de_commande')
    .select('id, numero, statut, fichier_url, objet, montant_total, signataire_role')
    .eq('id', opts.bonDeCommandeId).single()
  if (!bc) return { ok: false, error: 'Bon de commande introuvable.' }
  if (bc.statut !== 'brouillon') return { ok: false, error: 'Ce bon de commande a déjà été envoyé en signature.' }
  if (!bc.fichier_url) return { ok: false, error: 'PDF manquant pour ce bon de commande.' }

  const signataireQuery = bc.signataire_role === 'de'
    ? admin.from('profiles').select('id, nom, prenoms, email, civilite').eq('role', 'de').eq('archived', false).limit(1)
    : admin.from('profiles').select('id, nom, prenoms, email, civilite').eq('titre', 'president_ca').eq('archived', false).limit(1)
  const { data: signataireRows } = await signataireQuery
  const signataire = (signataireRows ?? [])[0]
  if (!signataire) {
    return {
      ok: false,
      error: bc.signataire_role === 'de'
        ? 'Aucun Directeur Exécutif actif — impossible d\'envoyer en signature.'
        : 'Aucun·e Président·e du CA actif·ve — impossible d\'envoyer en signature.',
    }
  }

  const { data: demande, error: demandeErr } = await admin.from('demandes_signature').insert({
    titre: `Bon de commande N° ${bc.numero}`,
    description: bc.objet,
    fichier_url: bc.fichier_url,
    createur_id: opts.createurId,
  }).select('id').single()
  if (demandeErr || !demande) return { ok: false, error: demandeErr?.message ?? 'Erreur lors de la création du circuit de signature.' }

  const { error: sigErr } = await admin.from('signataires').insert({
    demande_id: demande.id, profile_id: signataire.id, ordre: 0, est_observateur: false,
  })
  if (sigErr) {
    await admin.from('demandes_signature').delete().eq('id', demande.id)
    return { ok: false, error: sigErr.message }
  }

  await admin.from('bons_de_commande').update({ demande_signature_id: demande.id, statut: 'circuit_signature' }).eq('id', bc.id)

  await admin.from('signataires').update({ notifie: true }).eq('demande_id', demande.id).eq('profile_id', signataire.id)
  await admin.from('notifications').insert({
    user_id: signataire.id,
    titre: 'Bon de commande à signer',
    message: `Bon de commande N° ${bc.numero} — ${Number(bc.montant_total).toLocaleString('fr-FR')} FCFA.`,
    lien: `/signatures/${demande.id}/signer`,
  })
  if (signataire.email) {
    const civilite = accordGenre(signataire.civilite, 'Monsieur', 'Madame')
    await sendEmail({
      to: signataire.email,
      subject: `My ABED — Bon de commande à signer : N° ${bc.numero}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
          <p>Bonjour ${civilite} <strong>${signataire.prenoms} ${signataire.nom}</strong>,</p>
          <p>Un bon de commande attend votre signature :</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-size:16px;font-weight:700;">Bon de commande N° ${bc.numero}</p>
            <p style="margin:8px 0 0;color:#6b7280;">${bc.objet} — ${Number(bc.montant_total).toLocaleString('fr-FR')} FCFA</p>
          </div>
          <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
            Voir le document
          </a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · ABED ONG</p>
        </div>`,
    }).catch(e => console.error('[bon-de-commande] email signataire:', e))
  }

  return { ok: true, bonDeCommandeId: bc.id, numero: bc.numero }
}
