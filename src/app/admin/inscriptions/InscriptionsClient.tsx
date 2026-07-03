'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, ChevronUp, CheckCircle2 } from 'lucide-react'

type Pending = {
  id: string; civilite: string | null; nom: string; prenoms: string; email: string
  telephone: string | null; fonction: string | null; adresse: string | null
  date_naissance: string | null; lieu_naissance: string | null
  nationalite: string | null; created_at: string
}
type Manager = { id: string; nom: string; prenoms: string; role: string }

const ROLES = [
  { value: 'missionnaire',  label: 'Missionnaire' },
  { value: 'prestataire',   label: 'Prestataire' },
  { value: 'manager',       label: 'Manager' },
  { value: 'rh',            label: 'RH' },
  { value: 'aaf',           label: 'AAF' },
  { value: 'caf',           label: 'CAF' },
  { value: 'de',            label: 'Directeur Exécutif' },
  { value: 'administrateur', label: 'Administrateur (CA)' },
  { value: 'admin',         label: 'Admin système' },
]

const TYPES = [
  { value: 'cdi',                label: 'CDI' },
  { value: 'cdd',                label: 'CDD' },
  { value: 'benevole',           label: 'Bénévole' },
  { value: 'stagiaire_n1',       label: 'Stagiaire N1' },
  { value: 'stagiaire_n2',       label: 'Stagiaire N2' },
  { value: 'prestataire_direct', label: 'Prestataire direct' },
  { value: 'prestataire_credit', label: 'Prestataire crédit' },
]

const card: React.CSSProperties = {
  background: 'white', border: '1px solid var(--abed-border)',
  borderRadius: 10, padding: '20px 24px', marginBottom: 12,
}
const sel: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 13, background: 'white', width: '100%',
}

function InscriptionRow({ p, managers }: { p: Pending; managers: Manager[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('missionnaire')
  const [typeEmploi, setTypeEmploi] = useState('cdd')
  const [managerId, setManagerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  async function activate() {
    if (!role || !typeEmploi) { setErr('Rôle et type d\'emploi requis'); return }
    setLoading(true); setErr('')
    const res = await fetch(`/api/admin/inscriptions/${p.id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, type_emploi: typeEmploi, manager_id: managerId || null }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) { setDone(true); router.refresh() }
    else setErr(data.error ?? 'Erreur inconnue')
  }

  if (done) return null

  return (
    <div style={{ ...card, borderLeft: '4px solid var(--abed-green)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
            {p.civilite || 'M.'} {p.prenoms} {p.nom}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{p.email}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {p.fonction && <span>{p.fonction} · </span>}
            Inscrit le {new Date(p.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: open ? 'var(--abed-green)' : 'white', color: open ? 'white' : 'var(--abed-green)', border: '1px solid var(--abed-green)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          {open ? <><ChevronUp size={14} /> Fermer</> : <><UserCheck size={14} /> Activer</>}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f3f4f6' }}>
          {/* Info recap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 18, background: '#f9fafb', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
            {p.telephone && <span>📞 {p.telephone}</span>}
            {p.adresse && <span>📍 {p.adresse}</span>}
            {p.date_naissance && <span>🎂 {new Date(p.date_naissance).toLocaleDateString('fr-FR')}</span>}
            {p.lieu_naissance && <span>🏙️ {p.lieu_naissance}</span>}
            {p.nationalite && <span>🌍 {p.nationalite}</span>}
          </div>

          {/* Activation form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Rôle <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select style={sel} value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Type d&apos;emploi <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select style={sel} value={typeEmploi} onChange={e => setTypeEmploi(e.target.value)}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Responsable direct
              </label>
              <select style={sel} value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">— Aucun —</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.prenoms} {m.nom} ({m.role})</option>
                ))}
              </select>
            </div>
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 10, marginBottom: 0 }}>{err}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 10 }}>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Annuler
            </button>
            <button
              onClick={activate}
              disabled={loading}
              style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}
            >
              <UserCheck size={15} /> {loading ? 'Activation…' : 'Confirmer l\'activation'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InscriptionsClient({
  pending, managers,
}: {
  pending: Pending[]; managers: Manager[]; adminRole: string
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
            Inscriptions en attente
            {pending.length > 0 && (
              <span style={{ marginLeft: 10, background: '#ef4444', color: 'white', borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '2px 10px' }}>
                {pending.length}
              </span>
            )}
          </h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Utilisateurs qui ont confirmé leur email et attendent l&apos;activation de leur compte.
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: '#9ca3af' }}>
          <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Aucune inscription en attente d&apos;activation.</p>
        </div>
      ) : (
        <div>
          {pending.map(p => (
            <InscriptionRow key={p.id} p={p} managers={managers} />
          ))}
        </div>
      )}
    </>
  )
}
