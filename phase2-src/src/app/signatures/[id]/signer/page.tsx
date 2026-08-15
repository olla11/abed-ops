export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { formatSignatureDisplayName } from '@/lib/signature-name'
import { verifierTour } from '@/lib/signature-completion'
import SignerClient from './SignerClient'

export default async function SignerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: demandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Get demande with signataires
  const { data: demande, error } = await admin
    .from('demandes_signature')
    .select(`
      id, titre, description, fichier_url, statut,
      signataires(id, profile_id, signe, signe_le, est_observateur, ordre, sig_x, sig_y, sig_page)
    `)
    .eq('id', demandeId)
    .single()

  if (error || !demande) notFound()

  // Verify current user is an unsigned signatory — un observateur (destinataire
  // non-signataire) n'a rien à signer, il reçoit seulement le document final.
  const myEntry = (demande.signataires as Array<{ id: string; profile_id: string; signe: boolean; signe_le: string | null; est_observateur: boolean; ordre: number | null; sig_x: number | null; sig_y: number | null; sig_page: number | null }>)
    .find(s => s.profile_id === user.id)

  if (!myEntry || myEntry.signe || myEntry.est_observateur || demande.statut !== 'en_attente') {
    redirect('/signatures')
  }

  // Signature dans l'ordre choisi : si un signataire d'un palier antérieur
  // n'a pas encore signé, on affiche une carte d'attente plutôt que l'éditeur.
  const tour = await verifierTour(admin, demandeId, myEntry.ordre)
  if (!tour.ok) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9' }}>
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Pas encore votre tour</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            <strong>{tour.enAttenteDe}</strong> doit signer <strong>« {demande.titre} »</strong> avant vous. Vous recevrez un email et une notification dès que ce sera votre tour.
          </p>
        </div>
      </div>
    )
  }

  // Get user profile
  const { data: profile } = await admin
    .from('profiles')
    .select('nom, prenoms, signature_sauvegardee_b64')
    .eq('id', user.id)
    .single()

  const userName = profile
    ? formatSignatureDisplayName(profile.prenoms, profile.nom)
    : (user.email ?? 'Utilisateur')

  const zoneImposee = myEntry.sig_x !== null && myEntry.sig_x !== undefined
    ? { x: myEntry.sig_x, y: myEntry.sig_y ?? 50, page: myEntry.sig_page ?? 1 }
    : null

  return (
    <SignerClient
      demandeId={demandeId}
      titre={demande.titre}
      fichierUrl={demande.fichier_url ?? null}
      userName={userName}
      contratId={null}
      zoneImposee={zoneImposee}
      signatureEnregistree={profile?.signature_sauvegardee_b64 ?? null}
    />
  )
}
