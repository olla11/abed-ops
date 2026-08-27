import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { formatSignatureDisplayName as formatSignatureName } from '@/lib/signature-name'
import { genererContratPdf, nomFichierContratPdf, ORG_TEL, ORG_EMAIL, ORG_ADRESSE, type ContratPdfData } from '@/lib/contrat-pdf'

// Rendu via Chromium headless (au lieu du "Imprimer" du navigateur) — c'est
// le seul moyen d'obtenir un vrai fichier PDF avec marges fixées par le
// serveur, cohérent quel que soit le navigateur du destinataire.
export const runtime = 'nodejs'
export const maxDuration = 60

// Désignation de la partie employé dans le préambule, selon le type de contrat
function partieLabel(typeContrat: string | null | undefined): string {
  const t = (typeContrat ?? '').toLowerCase()
  if (t.includes('bénévol')) return 'Bénévole'
  if (t.includes('stage') || t.includes('stagiaire')) return 'Stagiaire'
  if (t.includes('prestataire')) return 'Prestataire'
  if (t.includes('consultant')) return 'Consultant'
  return 'Employé(e)'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contrat, error } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, civilite, role, fonction, telephone, email, adresse)')
    .eq('id', id)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

  const me = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = me.data?.role ?? ''
  const canView = ['rh', 'admin', 'de', 'dp', 'administrateur', 'aaf', 'caf'].includes(role) || contrat.profile_id === user.id
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Backfill : certains contrats plus anciens n'ont jamais reçu de numero (échec silencieux à la création)
  let numero = contrat.numero as string | null
  if (!numero) {
    const year = new Date().getFullYear()
    const { data: seqData, error: seqError } = await admin
      .rpc('nextval_contrats_seq' as Parameters<typeof admin.rpc>[0])
    if (!seqError && seqData != null) {
      numero = `${String(Number(seqData)).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
    } else {
      const { count } = await admin.from('contrats').select('id', { count: 'exact', head: true })
      numero = `${String(count ?? 1).padStart(3, '0')} /ABED-ONG/DE/DAF/CAF/${year}`
    }
    const { error: numeroErr } = await admin.from('contrats').update({ numero }).eq('id', id)
    if (numeroErr) console.error('[contrat-pdf] échec backfill numero:', numeroErr)
  }

  const p = contrat.profile as any
  const isDE = ['de', 'dp'].includes(p?.role)
  const categorie = contrat.categorie_document ?? 'Contrat'

  // Avenant : on affiche à quelle convention/contrat il se rattache, sous le
  // titre — le contrat parent porte déjà la référence via contrat_parent_id.
  let parentNumero: string | null = null
  if (categorie === 'Avenant' && contrat.contrat_parent_id) {
    const { data: parent } = await admin.from('contrats').select('numero, categorie_document').eq('id', contrat.contrat_parent_id).single()
    parentNumero = parent?.numero ?? null
  }
  const representantEmployeur = isDE ? "Président du Conseil d'Administration" : 'Directeur Exécutif'
  const sigLeft = isDE ? "Le Président du Conseil d'Administration" : "Le Directeur Exécutif"
  const partieEmploye = partieLabel(contrat.type_contrat)
  const sigRight = partieEmploye === 'Employé(e)' ? "L'Employé(e)" : `${p?.civilite === 'Mme' ? 'La' : 'Le'} ${partieEmploye}`
  const dateDebut = contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'
  const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : 'Indéterminée'
  const today = new Date().toLocaleDateString('fr-FR')

  // Représentant d'ABED affiché dans le préambule ET dans le bloc de
  // signature : priorité à la personne effectivement enregistrée comme
  // signataire du contrat (contrat.signataire_id) — c'est elle qui a
  // réellement signé le document, quel que soit le titulaire actuel du
  // poste. On ne retombe sur le titulaire courant du rôle que si le contrat
  // n'a pas encore été envoyé à un signataire (brouillon).
  let repProfile: { nom?: string; prenoms?: string; civilite?: string | null; telephone?: string | null; email?: string | null; adresse?: string | null; cachet_url?: string | null } | null = null
  if (contrat.signataire_id) {
    const { data } = await admin
      .from('profiles')
      .select('nom, prenoms, civilite, telephone, email, adresse, cachet_url')
      .eq('id', contrat.signataire_id)
      .single()
    repProfile = data
  } else {
    const { data } = await admin
      .from('profiles')
      .select('nom, prenoms, civilite, telephone, email, adresse, cachet_url')
      .eq('role', isDE ? 'administrateur' : 'de')
      .single()
    repProfile = data
  }
  const repNom = `${repProfile?.prenoms ?? ''} ${repProfile?.nom ?? ''}`.trim() || '—'
  // Le préambule "Entre les soussignés" présente l'organisation ABED-ONG :
  // ses coordonnées officielles (celles de l'entête), pas le téléphone/
  // l'adresse personnelle du représentant qui signe pour son compte.
  const repTel = ORG_TEL
  const repEmail = ORG_EMAIL
  const repAdresse = ORG_ADRESSE

  // Cachet du représentant (utilisé pour l'offre de stage, signée par le DE)
  let repCachetUrl: string | null = null
  if (repProfile?.cachet_url) {
    const { data: signedUrlData } = await admin.storage.from('assets').createSignedUrl(repProfile.cachet_url, 3600)
    repCachetUrl = signedUrlData?.signedUrl ?? null
  }

  // Statut de signature de l'employé
  const employeSigneLe = contrat.signe_employe_le
    ? new Date(contrat.signe_employe_le).toLocaleDateString('fr-FR')
    : null

  // Statut de signature du signataire (DE / PCA / autre) côté employeur.
  // Source de vérité : contrat.workflow_statut + contrat.signataire_id (jamais le circuit
  // générique demandes_signature/signataires, qui peut être absent ou désynchronisé).
  let signataireNom: string | null = null
  let signataireNomReel = ''
  let signataireSigneLe: string | null = null
  if (contrat.signataire_id && ['signe_signataire', 'finalise'].includes(contrat.workflow_statut ?? '')) {
    const { data: sigProfile } = await admin
      .from('profiles')
      .select('nom, prenoms')
      .eq('id', contrat.signataire_id)
      .single()
    signataireNom = formatSignatureName(sigProfile?.prenoms, sigProfile?.nom)
    signataireNomReel = `${sigProfile?.prenoms ?? ''} ${sigProfile?.nom ?? ''}`.trim()

    if (contrat.signe_signataire_le) {
      signataireSigneLe = new Date(contrat.signe_signataire_le).toLocaleDateString('fr-FR')
    }
  }

  const articles: Array<{ titre: string; contenu: string }> = Array.isArray(contrat.articles) ? contrat.articles : []

  // Date d'établissement affichée dans "Parakou, le ..." : la date de
  // signature la plus ancienne si le document est déjà signé (fixe, ne
  // change plus jamais), sinon la date du jour tant que le contrat est en
  // cours de rédaction.
  const datesSignature = [contrat.signe_employe_le, contrat.signe_signataire_le]
    .filter(Boolean)
    .map((d: string) => new Date(d).getTime())
  const dateEtablissement = datesSignature.length > 0
    ? new Date(Math.min(...datesSignature)).toLocaleDateString('fr-FR')
    : today

  const pdfData: ContratPdfData = {
    numero,
    categorie,
    typeContrat: contrat.type_contrat,
    poste: contrat.poste,
    direction: contrat.direction,
    dateDebut,
    dateFin,
    dateEtablissement,
    parentNumero,
    objet: contrat.objet,
    articles,
    observations: contrat.observations,
    salaireBrut: contrat.salaire_brut,
    representantEmployeur,
    sigLeft,
    sigRight,
    repNom,
    repTel,
    repEmail,
    repAdresse,
    repCachetUrl,
    employeCivilite: p?.civilite ?? null,
    employePrenoms: p?.prenoms ?? '',
    employeNom: p?.nom ?? '',
    employeTelephone: p?.telephone ?? null,
    employeEmail: p?.email ?? null,
    employeAdresse: p?.adresse ?? null,
    employeSigneLe,
    signataireNom,
    signataireNomReel,
    signataireSigneLe,
    partieEmploye,
  }

  const pdfBuffer = await genererContratPdf(pdfData)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierContratPdf(categorie, numero, id)}"`,
    },
  })
}
