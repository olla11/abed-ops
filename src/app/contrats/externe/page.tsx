export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyContratExterneToken } from '@/lib/contrat-externe-token'
import ContratExterneClient from './ContratExterneClient'

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9' }}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function ContratExternePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const token = t ?? ''

  const payload = verifyContratExterneToken(token)
  if (!payload) {
    return <ErrorCard title="Lien invalide ou expiré" message="Ce lien n'est plus valide (il expire 72h après son envoi). Contactez ABED ONG pour en recevoir un nouveau." />
  }

  const admin = createAdminClient()
  const { data: contrat } = await admin
    .from('contrats')
    .select('id, numero, categorie_document, type_contrat, poste, direction, date_debut, date_fin, objet, articles, workflow_statut, signe_employe_le, commentaires_rh, commentaires_employe, destinataire_email, destinataire_prenoms, destinataire_nom, profile_id')
    .eq('id', payload.contratId)
    .single()

  if (!contrat || contrat.destinataire_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return <ErrorCard title="Lien invalide" message="Ce lien est introuvable ou ne correspond plus à un document actif." />
  }

  if (contrat.profile_id) {
    return (
      <ErrorCard
        title="Compte My ABED trouvé"
        message="Ce document est maintenant rattaché à un compte My ABED existant. Connectez-vous à My ABED avec cette même adresse email pour le consulter."
      />
    )
  }

  return (
    <ContratExterneClient
      token={token}
      contrat={{
        id: contrat.id,
        numero: contrat.numero,
        categorieDocument: contrat.categorie_document,
        typeContrat: contrat.type_contrat,
        poste: contrat.poste,
        direction: contrat.direction,
        dateDebut: contrat.date_debut,
        dateFin: contrat.date_fin,
        objet: contrat.objet,
        articles: Array.isArray(contrat.articles) ? contrat.articles : [],
        workflowStatut: contrat.workflow_statut,
        signeLe: contrat.signe_employe_le,
        commentairesRh: contrat.commentaires_rh,
        commentairesDestinataire: contrat.commentaires_employe,
        destinatairePrenoms: contrat.destinataire_prenoms,
        destinataireNom: contrat.destinataire_nom,
      }}
    />
  )
}
