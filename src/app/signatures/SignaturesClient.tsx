'use client'
import { useState, useRef } from 'react'
import type { DemandeRow, ProfileOption, SignataireRow } from './page'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4,
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SignataireChip({ s }: { s: SignataireRow }) {
  const name = s.profile ? `${s.profile.prenoms} ${s.profile.nom}` : s.profile_id
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: s.signe ? '#dcfce7' : '#fef3c7',
      color: s.signe ? '#166534' : '#92400e',
      border: `1px solid ${s.signe ? '#86efac' : '#fde68a'}`,
    }}>
      {s.signe ? '✓' : '⏳'} {name}
      {s.signe && s.signe_le && <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>· {fmtDate(s.signe_le)}</span>}
    </span>
  )
}

function DemandeCard({ d, userId, onSigned }: { d: DemandeRow; userId: string; onSigned: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const createur = d.createur ? `${d.createur.prenoms} ${d.createur.nom}` : '—'
  const myEntry = d.signataires.find(s => s.profile_id === userId)
  const canSign = !!myEntry && !myEntry.signe && d.statut === 'en_attente'
  const signed = d.signataires.filter(s => s.signe).length
  const total = d.signataires.length

  async function sign() {
    setLoading(true); setErr(null)
    const res = await fetch(`/api/signatures/${d.id}/sign`, { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      onSigned(d.id)
    } else {
      const data = await res.json().catch(() => ({}))
      setErr(data.error ?? 'Erreur lors de la signature')
    }
  }

  return (
    <div style={{
      background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10,
      padding: '18px 22px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{d.titre}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
              background: d.statut === 'complete' ? '#dcfce7' : '#fef3c7',
              color: d.statut === 'complete' ? '#166534' : '#92400e',
            }}>
              {d.statut === 'complete' ? 'Complet' : 'En attente'}
            </span>
          </div>
          {d.description && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>{d.description}</p>
          )}
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
            Créé par <strong style={{ color: '#374151' }}>{createur}</strong> · {fmtDate(d.created_at)}
            {d.fichier_url && (
              <> · <a href={d.fichier_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--abed-green)', fontWeight: 600 }}>📄 Voir le document</a></>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {d.signataires.map(s => <SignataireChip key={s.profile_id} s={s} />)}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {signed}/{total} signataire{total > 1 ? 's' : ''} ont signé
          </div>
        </div>
        {canSign && (
          <div style={{ flexShrink: 0 }}>
            {d.fichier_url ? (
              <a
                href={`/signatures/${d.id}/signer`}
                style={{
                  display: 'inline-block',
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
                }}
              >
                📄 Ouvrir et signer
              </a>
            ) : (
              <button
                onClick={sign}
                disabled={loading}
                style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--abed-green)', color: 'white', border: 'none',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Signature...' : '✍️ Je signe'}
              </button>
            )}
            {err && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 6 }}>{err}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

type Props = {
  userId: string
  mesDemandesASign: DemandeRow[]
  mesCreations: DemandeRow[]
  toutesSignees: DemandeRow[]
  profiles: ProfileOption[]
}

export default function SignaturesClient({ userId, mesDemandesASign: initialASign, mesCreations: initialCreations, toutesSignees, profiles }: Props) {
  const [activeTab, setActiveTab] = useState<'asigner' | 'mesdemandes'>('asigner')
  const [demandesASign, setDemandesASign] = useState(initialASign)
  const [mesCreations, setMesCreations] = useState(initialCreations)
  const [showModal, setShowModal] = useState(false)

  // Creation form state
  const [form, setForm] = useState({ titre: '', description: '' })
  const [selectedSignataires, setSelectedSignataires] = useState<string[]>([])
  const [fichier, setFichier] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSigned(id: string) {
    setDemandesASign(list => list.filter(d => d.id !== id))
    setMesCreations(list => list.map(d => {
      if (d.id !== id) return d
      const updated = d.signataires.map(s =>
        s.profile_id === userId ? { ...s, signe: true, signe_le: new Date().toISOString() } : s
      )
      const allSigned = updated.every(s => s.signe)
      return { ...d, signataires: updated, statut: allSigned ? 'complete' : d.statut }
    }))
  }

  function toggleSignataire(id: string) {
    setSelectedSignataires(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function submitCreate() {
    if (!form.titre.trim()) { setCreateErr('Le titre est requis.'); return }
    if (selectedSignataires.length === 0) { setCreateErr('Choisissez au moins un signataire.'); return }

    setCreating(true); setCreateErr(null)
    const fd = new FormData()
    fd.append('titre', form.titre.trim())
    if (form.description.trim()) fd.append('description', form.description.trim())
    if (fichier) fd.append('fichier', fichier)
    fd.append('signataires', JSON.stringify(selectedSignataires))

    const res = await fetch('/api/signatures/create', { method: 'POST', body: fd })
    setCreating(false)

    if (res.ok) {
      const data = await res.json()
      setMesCreations(prev => [data.demande, ...prev])
      setShowModal(false)
      setForm({ titre: '', description: '' })
      setSelectedSignataires([])
      setFichier(null)
      if (fileRef.current) fileRef.current.value = ''
    } else {
      const data = await res.json().catch(() => ({}))
      setCreateErr(data.error ?? 'Erreur lors de la création')
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: 'none', borderRadius: 8,
    background: active ? 'var(--abed-green)' : 'transparent',
    color: active ? 'white' : '#374151',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Signatures électroniques</h2>
        <button
          onClick={() => { setShowModal(true); setCreateErr(null) }}
          style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}
        >
          + Nouvelle demande
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button style={tabStyle(activeTab === 'asigner')} onClick={() => setActiveTab('asigner')}>
          À signer {demandesASign.length > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
              {demandesASign.length}
            </span>
          )}
        </button>
        <button style={tabStyle(activeTab === 'mesdemandes')} onClick={() => setActiveTab('mesdemandes')}>
          Mes demandes
        </button>
      </div>

      {/* À signer tab */}
      {activeTab === 'asigner' && (
        <div>
          {demandesASign.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Aucun document en attente de votre signature.
            </div>
          ) : (
            demandesASign.map(d => (
              <DemandeCard key={d.id} d={d} userId={userId} onSigned={handleSigned} />
            ))
          )}
        </div>
      )}

      {/* Mes demandes tab */}
      {activeTab === 'mesdemandes' && (
        <div>
          {mesCreations.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Vous n'avez pas encore créé de demande de signature.
            </div>
          ) : (
            mesCreations.map(d => (
              <DemandeCard key={d.id} d={d} userId={userId} onSigned={handleSigned} />
            ))
          )}
        </div>
      )}

      {/* Creation modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 30, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 22, fontSize: 17, color: '#111827' }}>Nouvelle demande de signature</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Titre *</label>
              <input
                type="text"
                value={form.titre}
                onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex : Contrat de prestation Q3 2025"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Description (optionnel)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Contexte ou instructions pour les signataires..."
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Document PDF (optionnel)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => setFichier(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: '6px 10px' }}
              />
              {fichier && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📄 {fichier.name}</div>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Signataires * ({selectedSignataires.length} sélectionné{selectedSignataires.length > 1 ? 's' : ''})</label>
              <div style={{
                border: '1px solid var(--abed-border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                background: '#fafafa',
              }}>
                {profiles.filter(p => p.id !== userId).map(p => {
                  const selected = selectedSignataires.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', cursor: 'pointer',
                        background: selected ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSignataire(p.id)}
                        style={{ accentColor: 'var(--abed-green)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ fontWeight: selected ? 600 : 400, color: selected ? 'var(--abed-green)' : '#374151' }}>
                        {p.prenoms} {p.nom}
                      </span>
                      {p.role && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{p.role}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {createErr && (
              <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>
                {createErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowModal(false); setCreateErr(null) }}
                style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={submitCreate}
                disabled={creating}
                style={{
                  padding: '9px 20px', borderRadius: 8, cursor: creating ? 'not-allowed' : 'pointer',
                  background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700,
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Création...' : 'Créer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
