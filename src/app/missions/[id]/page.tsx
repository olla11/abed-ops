export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MissionActions from './MissionActions'
import MissionEditForm from './MissionEditForm'
import MissionDeleteButton from './MissionDeleteButton'

export default async function MissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mission } = await supabase
    .from('missions')
    .select(`
      *,
      missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, email, telephone, fonction),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, fonction)
    `)
    .eq('id', id)
    .single()

  if (!mission) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const canSign = ['caf', 'de', 'admin'].includes(role) && ['soumis', 'brouillon'].includes(mission.status)
  const canEdit = ['caf', 'de', 'admin'].includes(role) && ['soumis', 'brouillon'].includes(mission.status)
  const canDelete = role === 'admin'
  const pdfDispo = !['brouillon', 'soumis'].includes(mission.status)

  const STATUS_LABELS: Record<string, string> = {
    brouillon: 'Brouillon',
    soumis: 'Soumis — En attente de signature',
    signe: 'Signe',
    en_mission: 'En mission',
    reconciliation: 'Reconciliation requise',
    paiement_attente: 'Paiement en attente',
    cloture: 'Cloture',
    rejete: 'Rejete',
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
          <h2 style={{ color: 'var(--abed-green)', margin: '8px 0 4px' }}>
            Ordre de Mission {mission.reference ? `— ${mission.reference}` : ''}
          </h2>
          <span className={`badge ${mission.status}`}>{STATUS_LABELS[mission.status] ?? mission.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {pdfDispo && (
            <a className="btn secondary" href={`/api/om-pdf?missionId=${mission.id}`} target="_blank">
              Telecharger PDF
            </a>
          )}
          {mission.status === 'signe' && user.id === mission.missionnaire_id && (
            <Link className="btn" href={`/missions/${mission.id}/reconciliation`}>
              Faire la reconciliation
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Informations de la mission</h3>
        <table>
          <tbody>
            <Row label="Missionnaire" value={`${mission.missionnaire?.prenoms ?? ''} ${mission.missionnaire?.nom ?? ''}`} />
            <Row label="Fonction" value={mission.missionnaire?.fonction ?? '—'} />
            <Row label="Objet" value={mission.objet} />
            <Row label="Lieu" value={mission.lieu} />
            <Row label="Moyen de transport" value={mission.moyen_transport ?? '—'} />
            <Row label="Date de depart" value={new Date(mission.date_depart).toLocaleDateString('fr-FR')} />
            <Row label="Date de retour" value={new Date(mission.date_retour).toLocaleDateString('fr-FR')} />
            <Row label="Imputation" value={mission.imputation ?? '—'} />
            <Row label="A charge partenaire" value={mission.a_charge_partenaire ? 'Oui (prelevement 20 %)' : 'Non'} />
          </tbody>
        </table>
      </div>

      {mission.signe_le && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Signature</h3>
          <table><tbody>
            <Row label="Signe par" value={`${mission.signataire?.prenoms ?? ''} ${mission.signataire?.nom ?? ''} (${mission.signataire?.fonction ?? ''})`} />
            <Row label="Le" value={new Date(mission.signe_le).toLocaleDateString('fr-FR', { dateStyle: 'long' })} />
          </tbody></table>
        </div>
      )}

      {(mission.point_financier || mission.rapport) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Reconciliation</h3>
          <table><tbody>
            <Row label="Montant recu" value={mission.montant_recu != null ? `${Number(mission.montant_recu).toLocaleString('fr-FR')} FCFA` : '—'} />
            <Row label="Total depenses" value={mission.total_depenses != null ? `${Number(mission.total_depenses).toLocaleString('fr-FR')} FCFA` : '—'} />
            <Row label="Prelevement 20 %" value={mission.prelevement_20 != null ? `${Number(mission.prelevement_20).toLocaleString('fr-FR')} FCFA` : '—'} />
            <Row label="Solde missionnaire" value={mission.solde_missionnaire != null ? `${Number(mission.solde_missionnaire).toLocaleString('fr-FR')} FCFA` : '—'} />
          </tbody></table>
        </div>
      )}

      {canEdit && (
        <MissionEditForm mission={{
          id: mission.id, objet: mission.objet, lieu: mission.lieu,
          moyen_transport: mission.moyen_transport, conducteur_a_bord: mission.conducteur_a_bord,
          date_depart: mission.date_depart, date_arrivee_destination: mission.date_arrivee_destination,
          date_depart_destination: mission.date_depart_destination, date_retour: mission.date_retour,
          imputation: mission.imputation, a_charge_partenaire: mission.a_charge_partenaire,
        }} />
      )}

      {canSign && <MissionActions missionId={mission.id} />}

      {canDelete && (
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--abed-border)' }}>
          <MissionDeleteButton missionId={mission.id} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 600, width: 220, paddingRight: 16 }}>{label}</td>
      <td>{value}</td>
    </tr>
  )
}