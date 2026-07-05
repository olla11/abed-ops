export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MissionActions from './MissionActions'
import MissionEditForm from './MissionEditForm'
import MissionDeleteButton from './MissionDeleteButton'
import AppHeader from '@/components/AppHeader'
import ReconciliationValidationCAF from '@/components/ReconciliationValidationCAF'

export default async function MissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: mission } = await admin
    .from('missions')
    .select(`
      *,
      missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, email, telephone, fonction),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, fonction, role)
    `)
    .eq('id', id)
    .single()

  if (!mission) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const isLocked = mission.status === 'cloture'
  const canSign = ['caf', 'de', 'admin', 'administrateur'].includes(role) && ['soumis', 'brouillon'].includes(mission.status)
  const canEdit = ['caf', 'de', 'admin', 'administrateur'].includes(role) && ['soumis', 'brouillon'].includes(mission.status)
  const canDelete = role === 'admin'
  const pdfDispo = !['brouillon', 'soumis'].includes(mission.status)
  const canReconcile = user.id === mission.missionnaire_id
    && ['signe', 'en_mission', 'reconciliation'].includes(mission.status)
  const canValidateReconc = ['caf', 'admin'].includes(role) && mission.status === 'reconciliation_caf'

  const STATUS_LABELS: Record<string, string> = {
    brouillon: 'Brouillon',
    soumis: 'Soumis — En attente de signature',
    signe: 'Signé',
    en_mission: 'En mission',
    reconciliation: 'Réconciliation requise',
    reconciliation_caf: 'Validation CAF en attente',
    paiement_attente: 'Paiement en attente',
    cloture: 'Clôturé',
    rejete: 'Rejeté',
  }

  const MODE_LABELS: Record<string, string> = {
    credit: 'À crédit',
    avance: 'Sur avance',
    totalite_avant: 'Totalité avant départ',
  }

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={role === 'admin'}
      />
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
          <h2 style={{ color: 'var(--abed-green)', margin: '8px 0 4px' }}>
            Ordre de Mission {mission.reference ? `— ${mission.reference}` : ''}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${mission.status}`}>{STATUS_LABELS[mission.status] ?? mission.status}</span>
            {isLocked && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#166534',
                background: '#dcfce7', padding: '3px 10px', borderRadius: 999, border: '1px solid #86efac',
              }}>
                🔒 Dossier clôturé — lecture seule
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {pdfDispo && (
            <a className="btn secondary" href={`/api/om-pdf?missionId=${mission.id}`} target="_blank">
              Télécharger PDF
            </a>
          )}
          {canReconcile && (
            <Link className="btn" href={`/missions/${mission.id}/reconciliation`}>
              Faire la réconciliation
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
            <Row label="Date de départ" value={new Date(mission.date_depart).toLocaleDateString('fr-FR')} />
            <Row label="Date de retour" value={new Date(mission.date_retour).toLocaleDateString('fr-FR')} />
            <Row label="Imputation" value={mission.imputation ?? '—'} />
            <Row label="À charge partenaire" value={mission.a_charge_partenaire ? 'Oui (prélèvement 20 %)' : 'Non (à charge ABED)'} />
          </tbody>
        </table>
      </div>

      {mission.signe_le && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Signature</h3>
          <table><tbody>
            <Row label="Signé par" value={(() => {
              const s = mission.signataire as any
              if (!s) return '—'
              const ROLE_LABELS: Record<string, string> = { de: 'Directeur Exécutif', caf: 'CAF', admin: 'Administrateur', administrateur: 'Président du CA' }
              const nom = `${s.prenoms ?? ''} ${s.nom ?? ''}`.trim()
              const titre = s.fonction || ROLE_LABELS[s.role] || ''
              return [nom, titre].filter(Boolean).join(' — ')
            })()} />
            <Row label="Le" value={new Date(mission.signe_le).toLocaleDateString('fr-FR', { dateStyle: 'long' })} />
          </tbody></table>
        </div>
      )}

      {(mission.point_financier || mission.rapport) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Réconciliation</h3>
          <table><tbody>
            {mission.mode_financement && (
              <Row label="Mode financement" value={MODE_LABELS[mission.mode_financement] ?? mission.mode_financement} />
            )}
            <Row label="Montant reçu" value={mission.montant_recu != null ? `${Number(mission.montant_recu).toLocaleString('fr-FR')} FCFA` : '—'} />
            <Row label="Total dépenses" value={mission.total_depenses != null ? `${Number(mission.total_depenses).toLocaleString('fr-FR')} FCFA` : '—'} />
            {mission.a_charge_partenaire && (
              <Row label="Prélèvement 20 %" value={mission.prelevement_20 != null ? `${Number(mission.prelevement_20).toLocaleString('fr-FR')} FCFA` : '—'} />
            )}
            {mission.a_charge_partenaire && (
              <Row label="Solde missionnaire" value={mission.solde_missionnaire != null ? `${Number(mission.solde_missionnaire).toLocaleString('fr-FR')} FCFA` : '—'} />
            )}
          </tbody></table>
        </div>
      )}

      {canValidateReconc && (
        <ReconciliationValidationCAF
          missionId={id}
          mission={{
            mode_financement: mission.mode_financement,
            point_financier: mission.point_financier,
            rapport: mission.rapport,
            total_depenses: mission.total_depenses,
            reconciliation_commentaire: mission.reconciliation_commentaire,
          }}
        />
      )}

      {!isLocked && canEdit && (
        <MissionEditForm mission={{
          id: mission.id, objet: mission.objet, lieu: mission.lieu,
          moyen_transport: mission.moyen_transport, conducteur_a_bord: mission.conducteur_a_bord,
          date_depart: mission.date_depart, date_arrivee_destination: mission.date_arrivee_destination,
          date_depart_destination: mission.date_depart_destination, date_retour: mission.date_retour,
          imputation: mission.imputation, a_charge_partenaire: mission.a_charge_partenaire,
        }} />
      )}

      {!isLocked && canSign && <MissionActions missionId={mission.id} />}

      {canDelete && (
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--abed-border)' }}>
          <MissionDeleteButton missionId={mission.id} />
        </div>
      )}
    </div>
    </>
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
