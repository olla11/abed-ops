import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estRH, TITRE_LABELS, TYPE_EMPLOI_LABELS, type Titre, type TypeEmploi } from '@/lib/roles'
import {
  genererFichePersonnelPdf, nomFichierFichePersonnel,
  type FichePersonnelData, type FicheContrat, type FicheEvaluation, type FicheCongeSolde,
} from '@/lib/fiche-personnel-pdf'

// Rendu via Chromium headless — voir /api/contrat-pdf/[id] pour le même mécanisme.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('nom, prenoms, role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Le profil est lu directement (pas via le cache personnel, qui exclut les
  // comptes archivés) — la fiche doit rester accessible même pour une
  // personne sortie.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  if (profileError || !profile) return NextResponse.json({ error: 'Personnel introuvable' }, { status: 404 })

  const [{ data: contratsData }, { data: evaluationsData }, { data: soldesData }] = await Promise.all([
    admin.from('contrats')
      .select('id, numero, categorie_document, type_contrat, poste, date_debut, date_fin, statut, salaire_brut, heures_max_mois, contrat_parent_id, renouvele_depuis')
      .eq('profile_id', id)
      .order('date_debut', { ascending: true }),
    admin.from('evaluations')
      .select('id, declenchee_le, score_moyen, statut, evaluateur:profiles!evaluateur_id(nom, prenoms)')
      .eq('profile_id', id)
      .order('declenchee_le', { ascending: false }),
    admin.from('soldes_conges')
      .select('jours_acquis, jours_pris, type_conge:types_conge(nom)')
      .eq('profile_id', id)
      .eq('annee', new Date().getFullYear()),
  ])

  const contrats: FicheContrat[] = (contratsData ?? []) as FicheContrat[]

  const evaluations: FicheEvaluation[] = (evaluationsData ?? []).map((e: any) => ({
    id: e.id,
    declenchee_le: e.declenchee_le,
    score_moyen: e.score_moyen,
    statut: e.statut,
    evaluateur_nom: e.evaluateur ? `${e.evaluateur.prenoms} ${e.evaluateur.nom}` : null,
  }))

  const soldes: FicheCongeSolde[] = (soldesData ?? []).map((s: any) => ({
    type: s.type_conge?.nom ?? 'Congé',
    jours_acquis: Number(s.jours_acquis ?? 0),
    jours_pris: Number(s.jours_pris ?? 0),
  }))

  let photoUrl: string | null = profile.avatar_url ?? null
  if (photoUrl && photoUrl.startsWith('http')) {
    // Le bucket "avatars" est public — inutile de resigner l'URL, mais un
    // fetch échoue rarement en environnement serverless (DNS/robots) ; en
    // cas d'échec on affiche simplement les initiales plutôt que planter le PDF.
    try {
      const res = await fetch(photoUrl)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') ?? 'image/jpeg'
        photoUrl = `data:${contentType};base64,${buf.toString('base64')}`
      } else {
        photoUrl = null
      }
    } catch {
      photoUrl = null
    }
  }

  const data: FichePersonnelData = {
    civilite: profile.civilite,
    nom: profile.nom,
    prenoms: profile.prenoms,
    matricule: profile.matricule,
    photoUrl,
    titreLabel: profile.titre ? (TITRE_LABELS[profile.titre as Titre] ?? profile.titre) : null,
    fonction: profile.fonction,
    direction: profile.direction,
    typeEmploiLabel: profile.type_emploi ? (TYPE_EMPLOI_LABELS[profile.type_emploi as TypeEmploi] ?? profile.type_emploi) : null,
    archived: !!profile.archived,
    archivedAt: profile.archived_at,
    archivedReason: profile.archived_reason,
    email: profile.email,
    telephone: profile.telephone,
    adresse: profile.adresse,
    ville: profile.ville,
    dateNaissance: profile.date_naissance,
    lieuNaissance: profile.lieu_naissance,
    nationalite: profile.nationalite,
    genre: profile.genre,
    niveauEtude: profile.niveau_etude,
    nombreEnfants: profile.nombre_enfants,
    ifu: profile.ifu,
    numeroImmatriculation: profile.numero_immatriculation,
    gradeIndice: profile.grade_indice,
    dateEmbauche: profile.date_embauche,
    biographie: profile.biographie,
    citationFavorite: profile.citation_favorite,
    lienProfessionnel: profile.lien_professionnel,
    notesRh: profile.notes_rh,
    contrats,
    evaluations,
    conges: { annee: new Date().getFullYear(), soldes },
    genereLe: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    genereParNom: me?.prenoms && me?.nom ? `${me.prenoms} ${me.nom}` : 'RH',
  }

  const pdfBuffer = await genererFichePersonnelPdf(data)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierFichePersonnel(profile.nom, profile.prenoms)}"`,
    },
  })
}
