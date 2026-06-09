'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import DemandePaiementForm from './DemandePaiementForm'

type Soumission = {
  id: string; titre: string; status: string
  periode_mois: number; periode_annee: number
  heures_declarees: number; heures_retenues: number | null; montant_caf: number | null
  commentaire_manager: string | null; commentaire_caf: string | null
  fichier_timesheet_url: string | null; fichier_livrable_url: string | null; fichier_facture_url: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:              { label: 'En attente manager',           color: '#92660b' },
  valide_tech:         { label: '✓ Validé — demande de paiement requise', color: '#1e40af' },
  demande_soumise:     { label: 'Demande de paiement soumise',  color: '#6d28d9' },
  valide_caf:          { label: 'Validé ✓',                    color: '#166534' },
  corrections_tech:    { label: '⚠ Corrections demandées',      color: '#9a3412' },
  corrections_caf:     { label: '⚠ Corrections CAF',            color: '#9a3412' },
  rejete_tech:         { label: '✗ Rejeté (manager)',            color: '#991b1b' },
  rejete_caf:          { label: '✗ Rejeté (CAF)',                color: '#991b1b' },
}

const CORRECTABLE = ['corrections_tech', 'corrections_caf', 'rejete_tech', 'rejete_caf']

async function uploadFile(file: File, slot: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('slot', slot)
  const res = await fetch('/api/timesheets/upload', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'upload échoué')
  return json.path as string
}

async function openSignedFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir le fichier : ' + (json.error ?? 'erreur inconnue'))
}

export default function SoumissionForm({ managerId, typeEmploi }: { managerId: string; typeEmploi?: string | null }) {
  const supabase = createClient()
  const estCredit = typeEmploi === 'prestataire_credit'
  const estDirect = typeEmploi === 'prestataire_direct'

  const [titre, setTitre] = useState('')
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [heures, setHeures] = useState<number | ''>('')
  const [fileTS, setFileTS] = useState<File | null>(null)
  const [fileLiv, setFileLiv] = useState<File | null>(null)
  const [fileFac, setFileFac] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Soumission[]>([])
  const [resubmitting, setResubmitting] = useState<string | null>(null)
  const [reFiles, setReFiles] = useState<Record<string, { ts?: File; liv?: File; fac?: File }>>({})
  const [demandeForSoum, setDemandeForSoum] = useState<Soumission | null>(null)
  const [solde, setSolde] = useState<{
    entries: any[]; paiements: any[]
    totalHeures: number; totalMontant: number; totalPaye: number; resteADevoir: number
  } | null>(null)
  const tsRef = useRef<HTMLInputElement>(null)
  const livRef = useRef<HTMLInputElement>(null)
  const facRef = useRef<HTMLInputElement>(null)

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('soumissions')
      .select('id,titre,status,periode_mois,periode_annee,heures_declarees,heures_retenues,montant_caf,commentaire_manager,commentaire_caf,fichier_timesheet_url,fichier_livrable_url,fichier_facture_url')
      .eq('prestataire_id', user.id)
      .order('created_at', { ascending: false })
    setHistory((data as any) ?? [])
    if (typeEmploi === 'prestataire_credit') {
      const res = await fetch('/api/timesheets/mon-solde')
      const json = await res.json()
      if (res.ok) setSolde(json)
    }
  }

  useEffect(() => { loadHistory() }, [])

  async function submit() {
    if (!titre.trim()) { setMsg('Donnez un titre à votre soumission.'); return }
    if (!heures || heures <= 0) { setMsg('Saisissez le nombre d\'heures déclarées.'); return }
    if (!fileTS) { setMsg('Le fichier Excel timesheet est obligatoire.'); return }
    if (!estDirect && !estCredit && !fileLiv) { setMsg('Le fichier PDF livrable est obligatoire.'); return }
    if (!estDirect && !estCredit && !fileFac) { setMsg('Le fichier PDF facture est obligatoire.'); return }

    setLoading(true); setMsg('Envoi des fichiers…')
    try {
      const [urlTS, urlLiv, urlFac] = await Promise.all([
        uploadFile(fileTS, 'timesheet'),
        fileLiv ? uploadFile(fileLiv, 'livrable') : Promise.resolve(''),
        fileFac ? uploadFile(fileFac, 'facture') : Promise.resolve(''),
      ])
      setMsg('Création de la soumission…')
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre, periode_mois: mois, periode_annee: annee,
          heures_declarees: heures,
          fichier_timesheet_url: urlTS,
          fichier_livrable_url: urlLiv || undefined,
          fichier_facture_url: urlFac || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); return }
      setMsg('✓ Timesheet envoyé à votre responsable pour validation.')
      setTitre(''); setHeures('')
      setFileTS(null); setFileLiv(null); setFileFac(null)
      if (tsRef.current) tsRef.current.value = ''
      if (livRef.current) livRef.current.value = ''
      if (facRef.current) facRef.current.value = ''
      loadHistory()
    } catch (e: any) {
      setMsg('Erreur : ' + e.message)
    } finally { setLoading(false) }
  }

  async function resoumettre(soumId: string) {
    const rf = reFiles[soumId] ?? {}
    setResubmitting(soumId)
    try {
      const uploads: Record<string, string> = {}
      if (rf.ts) uploads.fichier_timesheet_url = await uploadFile(rf.ts, 'timesheet')
      if (rf.liv) uploads.fichier_livrable_url = await uploadFile(rf.liv, 'livrable')
      if (rf.fac) uploads.fichier_facture_url = await uploadFile(rf.fac, 'facture')
      const res = await fetch(`/api/timesheets/${soumId}/resoumettre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploads),
      })
      const json = await res.json()
      if (!res.ok) { alert('Erreur : ' + json.error); return }
      setReFiles(r => { const c = { ...r }; delete c[soumId]; return c })
      loadHistory()
    } catch (e: any) {
      alert('Erreur : ' + e.message)
    } finally { setResubmitting(null) }
  }

  const msgBg = msg.startsWith('✓') ? '#dcfce7' : msg.startsWith('Erreur') ? '#fee2e2' : '#e0f2fe'
  const msgColor = msg.startsWith('✓') ? '#166534' : msg.startsWith('Erreur') ? '#991b1b' : '#1e40af'

  const toCorrect = history.filter(s => CORRECTABLE.includes(s.status))
  const prets = estDirect ? history.filter(s => s.status === 'valide_tech') : []
  const others = history.filter(s => !CORRECTABLE.includes(s.status) && s.status !== 'valide_tech')

  // Si le formulaire de demande de paiement est ouvert, on l'affiche seul
  if (demandeForSoum) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--abed-green)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>💳 Demande de paiement</h3>
            <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
              Timesheet validé : <strong>{demandeForSoum.titre}</strong> — {demandeForSoum.periode_mois}/{demandeForSoum.periode_annee}
              {demandeForSoum.montant_caf != null && (
                <> — <strong style={{ color: 'var(--abed-green)' }}>{demandeForSoum.montant_caf.toLocaleString('fr-FR')} XOF</strong></>
              )}
            </p>
          </div>
          <button className="btn secondary" style={{ fontSize: 12 }}
            onClick={() => setDemandeForSoum(null)}>
            ← Retour
          </button>
        </div>
        <DemandePaiementForm
          onClose={() => { setDemandeForSoum(null); loadHistory() }}
          soumissionId={demandeForSoum.id}
          prefill={{
            objet: `Paiement timesheet : ${demandeForSoum.titre} (${demandeForSoum.periode_mois}/${demandeForSoum.periode_annee})`,
            montant: demandeForSoum.montant_caf != null ? String(demandeForSoum.montant_caf) : '',
            nature_depense: 'Prestation directe',
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>

      {/* ── Compteur crédit ── */}
      {estCredit && solde && (
        <div style={{ display: 'grid', gap: 16 }}>

          {/* Compteurs cumulatifs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'Heures totales validées', value: `${solde.totalHeures} h`, color: '#1e40af' },
              { label: 'Montant total validé', value: `${solde.totalMontant.toLocaleString('fr-FR')} F`, color: '#0f766e' },
              { label: 'Total payé', value: `${solde.totalPaye.toLocaleString('fr-FR')} F`, color: '#166534' },
              { label: 'Reste à percevoir', value: `${solde.resteADevoir.toLocaleString('fr-FR')} F`, color: solde.resteADevoir > 0 ? '#92660b' : '#166534' },
            ].map(c => (
              <div key={c.label} style={{ background: 'white', border: `2px solid ${c.color}22`,
                borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 3 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Détail par mois */}
          {solde.entries.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid var(--abed-border)' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>📋 Détail par mois</h3>
              </div>
              <div>
                {solde.entries.map((e: any) => {
                  const estValide = e.status === 'valide_caf'
                  const isPaye = e.paye
                  return (
                    <div key={e.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 16px', borderBottom: '1px solid var(--abed-border)',
                      flexWrap: 'wrap', gap: 8,
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{e.titre}</span>
                        <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 8 }}>
                          {e.mois}/{e.annee}
                        </span>
                        {e.heures > 0 && (
                          <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>
                            · {e.heures} h
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {e.montant > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>
                            {e.montant.toLocaleString('fr-FR')} F
                          </span>
                        )}
                        {estValide ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                            background: isPaye ? '#dcfce7' : '#fef9c3',
                            color: isPaye ? '#166534' : '#92660b',
                          }}>
                            {isPaye ? '✓ Payé' : '⏳ En attente paiement'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                            background: '#dbeafe', color: '#1e40af' }}>
                            En validation
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Historique paiements reçus */}
          {solde.paiements.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>💳 Versements reçus</h3>
              {solde.paiements.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--abed-border)', fontSize: 13 }}>
                  <span>
                    <strong style={{ color: '#166534' }}>{Number(p.montant).toLocaleString('fr-FR')} F</strong>
                    {p.note && <span style={{ color: 'var(--abed-muted)', marginLeft: 8 }}>— {p.note}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                    {new Date(p.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Timesheets validés — demande de paiement à faire (directs seulement) ── */}
      {prets.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #166534', background: '#f0fdf4' }}>
          <h3 style={{ color: '#166534', marginBottom: 6 }}>
            ✅ Timesheet{prets.length > 1 ? 's' : ''} validé{prets.length > 1 ? 's' : ''} — demande de paiement à soumettre
          </h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 14 }}>
            Votre responsable a validé ce timesheet. Cliquez sur le bouton ci-dessous pour soumettre votre demande de paiement.
          </p>
          {prets.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid #bbf7d0', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.titre}</span>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                  {s.periode_mois}/{s.periode_annee}
                  {s.heures_retenues != null && ` · ${s.heures_retenues} h retenues`}
                </span>
                {s.montant_caf != null && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginLeft: 10 }}>
                    {s.montant_caf.toLocaleString('fr-FR')} XOF
                  </span>
                )}
              </div>
              <button className="btn" style={{ fontSize: 13, background: '#166534' }}
                onClick={() => setDemandeForSoum(s)}>
                💳 Faire la demande de paiement
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Dossiers à corriger ── */}
      {toCorrect.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #c0392b' }}>
          <h3 style={{ marginBottom: 12, color: '#991b1b' }}>Dossiers à corriger ({toCorrect.length})</h3>
          {toCorrect.map(s => {
            const st = STATUS_LABEL[s.status]
            const rf = reFiles[s.id] ?? {}
            const comment = s.commentaire_manager || s.commentaire_caf
            return (
              <div key={s.id} style={{ background: '#fff5f5', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{s.titre}</strong>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    background: st.color + '22', color: st.color }}>{st.label}</span>
                </div>
                {comment && (
                  <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 10, fontStyle: 'italic' }}>
                    Commentaire : {comment}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {s.fichier_timesheet_url && (
                    <button className="btn secondary" style={{ fontSize: 11 }}
                      onClick={() => openSignedFile(s.fichier_timesheet_url!)}>
                      📊 Voir timesheet actuel
                    </button>
                  )}
                  {s.fichier_livrable_url && (
                    <button className="btn secondary" style={{ fontSize: 11 }}
                      onClick={() => openSignedFile(s.fichier_livrable_url!)}>
                      📄 Voir livrable actuel
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 8 }}>
                  Téléversez uniquement les fichiers à remplacer :
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>📊 Nouveau timesheet Excel</label>
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'block', fontSize: 11, marginTop: 4 }}
                      onChange={e => setReFiles(r => ({ ...r, [s.id]: { ...r[s.id], ts: e.target.files?.[0] } }))} />
                  </div>
                  {!estDirect && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>📄 Nouveau livrable</label>
                      <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'block', fontSize: 11, marginTop: 4 }}
                        onChange={e => setReFiles(r => ({ ...r, [s.id]: { ...r[s.id], liv: e.target.files?.[0] } }))} />
                    </div>
                  )}
                </div>
                <button className="btn" style={{ fontSize: 12 }}
                  disabled={resubmitting === s.id}
                  onClick={() => resoumettre(s.id)}>
                  {resubmitting === s.id ? '⏳ Resoumission…' : '↩ Resoumettre'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Nouvelle soumission ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>
          {estDirect ? 'Soumettre un timesheet' : 'Soumettre un dossier mensuel'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
          {estDirect || estCredit
            ? 'Le timesheet Excel est obligatoire. Un livrable est optionnel.'
            : 'Joignez les trois fichiers obligatoires (timesheet, livrable, facture).'}
        </p>

        <div className="field">
          <label className="label">Titre de la soumission *</label>
          <input className="input" value={titre}
            placeholder="Ex : Timesheet juin 2026 — Accompagnement startups"
            onChange={e => setTitre(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Mois *</label>
            <input className="input" type="number" min={1} max={12} value={mois}
              onChange={e => setMois(+e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Année *</label>
            <input className="input" type="number" value={annee}
              onChange={e => setAnnee(+e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Heures déclarées *</label>
            <input className="input" type="number" min={0.5} step={0.5}
              value={heures} placeholder="ex : 20"
              onChange={e => setHeures(e.target.value ? +e.target.value : '')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: (estDirect || estCredit) ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">📊 Timesheet Excel *</label>
            <input ref={tsRef} className="input" type="file" accept=".xlsx,.xls,.csv"
              onChange={e => setFileTS(e.target.files?.[0] ?? null)} />
          </div>
          <div className="field">
            <label className="label">📄 Livrable {(estDirect || estCredit) ? '(optionnel)' : '*'}</label>
            <input ref={livRef} className="input" type="file" accept=".pdf,.doc,.docx"
              onChange={e => setFileLiv(e.target.files?.[0] ?? null)} />
          </div>
          {!estDirect && !estCredit && (
            <div className="field">
              <label className="label">🧾 Facture PDF *</label>
              <input ref={facRef} className="input" type="file" accept=".pdf"
                onChange={e => setFileFac(e.target.files?.[0] ?? null)} />
            </div>
          )}
        </div>

        {msg && (
          <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: msgBg, color: msgColor }}>{msg}</p>
        )}
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? '⏳ Envoi en cours…' : 'Soumettre pour validation'}
        </button>
      </div>

      {/* ── Historique ── */}
      {others.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Mes soumissions</h3>
          <div className="table-wrap">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr><th>Titre</th><th>Période</th><th>H décl.</th><th>H ret.</th><th>Montant</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {others.map(s => {
                  const st = STATUS_LABEL[s.status] ?? { label: s.status, color: '#374151' }
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.titre}</td>
                      <td style={{ fontSize: 12 }}>{s.periode_mois}/{s.periode_annee}</td>
                      <td style={{ fontSize: 12 }}>{s.heures_declarees} h</td>
                      <td style={{ fontSize: 12 }}>{s.heures_retenues != null ? `${s.heures_retenues} h` : '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {s.montant_caf != null ? `${s.montant_caf.toLocaleString('fr-FR')} F` : '—'}
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: 11, fontWeight: 600, background: st.color + '22', color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
