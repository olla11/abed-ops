'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Pencil, Download, Plus, Trash2, FileDown, QrCode } from 'lucide-react'
import type { PresenceQuestion, PresenceQuestionType } from '@/lib/presence'

type Config = { id: string; slug: string; questions: PresenceQuestion[]; motifs: string[] }
type Enregistrement = {
  id: string; nom: string; prenom: string; telephone: string; email: string | null
  motif: string | null; reponses: Record<string, string>; created_at: string
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const TYPE_LABELS: Record<PresenceQuestionType, string> = {
  texte: 'Texte libre', choix: 'Choix multiple', email: 'Email', telephone: 'Téléphone',
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export default function PresenceAdminClient({ config, configError, lien, qrDataUrl, enregistrements }: {
  config: Config | null; configError?: string | null; lien: string; qrDataUrl: string | null; enregistrements: Enregistrement[]
}) {
  const router = useRouter()
  const [slugEdit, setSlugEdit] = useState(config?.slug ?? '')
  const [editingSlug, setEditingSlug] = useState(false)
  const [motifs, setMotifs] = useState<string[]>(config?.motifs ?? [])
  const [nouveauMotif, setNouveauMotif] = useState('')
  const [questions, setQuestions] = useState<PresenceQuestion[]>(config?.questions ?? [])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function patch(body: Record<string, unknown>) {
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/presence/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: d.error ?? 'Erreur' }); return false }
      router.refresh()
      setMsg({ type: 'ok', text: 'Enregistré.' })
      return true
    } catch {
      setMsg({ type: 'err', text: 'Erreur réseau' })
      return false
    } finally {
      setLoading(false)
    }
  }

  async function personnaliser() {
    const ok = await patch({ action: 'personnaliser', slug: slugEdit })
    if (ok) setEditingSlug(false)
  }

  async function regenerer() {
    if (!confirm("Générer un nouveau lien aléatoire ? L'ancien lien et son QR code cesseront de fonctionner immédiatement.")) return
    await patch({ action: 'regenerer' })
  }

  function ajouterMotif() {
    if (!nouveauMotif.trim()) return
    setMotifs(m => [...m, nouveauMotif.trim()])
    setNouveauMotif('')
  }

  function ajouterQuestion() {
    setQuestions(q => [...q, { id: uid(), label: '', type: 'texte', requis: false }])
  }

  function exporterCsv() {
    const entetesQuestions = questions.map(q => q.label)
    const entetes = ['Nom', 'Prénom', 'Téléphone', 'Email', 'Motif', ...entetesQuestions, 'Date']
    const lignes = enregistrements.map(e => [
      e.nom, e.prenom, e.telephone, e.email ?? '', e.motif ?? '',
      ...questions.map(q => e.reponses?.[q.id] ?? ''),
      new Date(e.created_at).toLocaleString('fr-FR'),
    ])
    const csv = [entetes, ...lignes]
      .map(ligne => ligne.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `presence_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!config) return (
    <div>
      <p style={{ color: 'var(--abed-muted)' }}>Configuration introuvable.</p>
      {configError && (
        <p style={{ color: '#dc2626', fontSize: 12, fontFamily: 'monospace', marginTop: 8 }}>{configError}</p>
      )}
    </div>
  )

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Présence des visiteurs</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 24px' }}>
        Lien public d&apos;enregistrement pour les visiteurs d&apos;ABED — à scanner (QR) ou consulter directement, sans compte My ABED.
      </p>

      {msg && (
        <div style={{
          fontSize: 13, padding: '8px 14px', borderRadius: 8, marginBottom: 16,
          background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'ok' ? '#166534' : '#991b1b',
          border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Lien + QR */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          {qrDataUrl && <img src={qrDataUrl} alt="QR code d'enregistrement" style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid var(--abed-border)' }} />}
          {qrDataUrl && (
            <a href={qrDataUrl} download="qr-presence-abed.png" className="btn secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12.5 }}>
              <Download size={14} /> Télécharger le QR
            </a>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: '#374151' }}>Lien public</label>
          {editingSlug ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--abed-muted)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{lien.replace(config.slug, '')}</span>
              <input value={slugEdit} onChange={e => setSlugEdit(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="accueil-abed" />
              <button className="btn" disabled={loading} onClick={personnaliser} style={{ fontSize: 13 }}>Enregistrer</button>
              <button className="btn secondary" onClick={() => { setEditingSlug(false); setSlugEdit(config.slug) }} style={{ fontSize: 13 }}>Annuler</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 13, background: '#f9fafb', border: '1px solid var(--abed-border)', borderRadius: 6, padding: '6px 10px' }}>{lien}</code>
              <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(lien)} style={{ fontSize: 12.5 }}>Copier</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!editingSlug && (
              <button className="btn secondary" onClick={() => setEditingSlug(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <Pencil size={14} /> Personnaliser le lien
              </button>
            )}
            <button className="btn secondary" disabled={loading} onClick={regenerer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#b45309' }}>
              <RefreshCw size={14} /> Régénérer le lien et le QR
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 10 }}>
            Régénérer crée un nouveau lien aléatoire et invalide immédiatement l&apos;ancien QR imprimé.
          </p>
        </div>
      </div>

      {/* Motifs de visite */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Motifs de visite proposés</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {motifs.map((m, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 20, padding: '5px 12px', fontSize: 13 }}>
              {m}
              <button onClick={() => setMotifs(ms => ms.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', display: 'flex' }}>
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={nouveauMotif} onChange={e => setNouveauMotif(e.target.value)} placeholder="Nouveau motif..." style={{ ...inputStyle, flex: 1, maxWidth: 240 }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), ajouterMotif())} />
          <button className="btn secondary" onClick={ajouterMotif} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Plus size={14} /> Ajouter</button>
          <button className="btn" disabled={loading} onClick={() => patch({ motifs })} style={{ fontSize: 13, marginLeft: 'auto' }}>Enregistrer les motifs</button>
        </div>
      </div>

      {/* Questions personnalisées */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Questions supplémentaires</h3>
        {questions.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', marginBottom: 12 }}>Aucune question ajoutée — le formulaire ne demande que Nom, Prénom, Téléphone, Email et Motif.</p>}
        {questions.map((q, i) => (
          <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              value={q.label}
              onChange={e => setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, label: e.target.value } : x))}
              placeholder="Intitulé de la question"
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            />
            <select
              value={q.type}
              onChange={e => setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, type: e.target.value as PresenceQuestionType } : x))}
              style={inputStyle}
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {q.type === 'choix' && (
              <input
                value={(q.options ?? []).join(', ')}
                onChange={e => setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) } : x))}
                placeholder="Options séparées par des virgules"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#374151', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={q.requis} onChange={e => setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, requis: e.target.checked } : x))} />
              Obligatoire
            </label>
            <button onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn secondary" onClick={ajouterQuestion} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Plus size={14} /> Ajouter une question</button>
          <button className="btn" disabled={loading} onClick={() => patch({ questions })} style={{ fontSize: 13, marginLeft: 'auto' }}>Enregistrer les questions</button>
        </div>
      </div>

      {/* Enregistrements */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>Enregistrements ({enregistrements.length})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => router.refresh()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <RefreshCw size={13} /> Actualiser
            </button>
            <button className="btn secondary" onClick={exporterCsv} disabled={enregistrements.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <FileDown size={13} /> Exporter CSV
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Nom &amp; Prénom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Motif</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {enregistrements.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.prenom} {e.nom}</td>
                  <td>{e.telephone}</td>
                  <td>{e.email ?? '—'}</td>
                  <td>{e.motif ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{new Date(e.created_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {enregistrements.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--abed-muted)', padding: '24px 0' }}>
                  <QrCode size={24} style={{ marginBottom: 6, opacity: .5 }} /><br />Aucun enregistrement pour l&apos;instant.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
