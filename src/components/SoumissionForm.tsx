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
  soumis:           { label: 'En attente manager',          color: '#92660b' },
  valide_tech:      { label: 'Validé techn. — attente CAF', color: '#1e40af' },
  valide_caf:       { label: 'Validé ✓',                   color: '#166534' },
  corrections_tech: { label: '⚠ Corrections demandées',     color: '#9a3412' },
  corrections_caf:  { label: '⚠ Corrections CAF',           color: '#9a3412' },
  rejete_tech:      { label: '✗ Rejeté (manager)',           color: '#991b1b' },
  rejete_caf:       { label: '✗ Rejeté (CAF)',               color: '#991b1b' },
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
  const estDirect = typeEmploi === 'prestataire_direct' || typeEmploi === 'cdd'
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
  }

  useEffect(() => { loadHistory() }, [])

  async function submit() {
    if (!titre.trim()) { setMsg('Donnez un titre à votre soumission.'); return }
    if (!heures || heures <= 0) { setMsg('Saisissez le nombre d\'heures déclarées.'); return }
    if (!fileTS) { setMsg('Le fichier Excel timesheet est obligatoire.'); return }
    if (!estDirect && !fileLiv) { setMsg('Le fichier PDF livrable est obligatoire.'); return }
    if (!estDirect && !fileFac) { setMsg('Le fichier PDF facture est obligatoire.'); return }

    setLoading(true); setMsg('Envoi des fichiers…')
    try {
      const uploads = await Promise.all([
        uploadFile(fileTS, 'timesheet'),
        fileLiv ? uploadFile(fileLiv, 'livrable') : Promise.resolve(''),
        fileFac ? uploadFile(fileFac, 'facture') : Promise.resolve(''),
      ])
      const [urlTS, urlLiv, urlFac] = uploads
      setMsg('Création de la soumission…')
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre, periode_mois: mois, periode_annee: annee,
          heures_declarees: heures,
          fichier_timesheet_url: urlTS,
          fichier_livrable_url: urlLiv,
          fichier_facture_url: urlFac,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); setLoading(false); return }
      setMsg('✓ Soumission envoyée à votre responsable technique.')
      setTitre(''); setHeures('')
      setFileTS(null); setFileLiv(null); setFileFac(null)
      if (tsRef.current) tsRef.current.value = ''
      if (livRef.current) livRef.current.value = ''
      if (facRef.current) facRef.current.value = ''
      loadHistory()
    } catch (e: any) {
      setMsg('Erreur : ' + e.message)
    } finally {
      setLoading(false)
    }
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
    } finally {
      setResubmitting(null)
    }
  }

  const msgBg = msg.startsWith('✓') ? '#dcfce7' : (msg.startsWith('Envoi') || msg.startsWith('Création')) ? '#e0f2fe' : '#fee2e2'
  const msgColor = msg.startsWith('✓') ? '#166534' : (msg.startsWith('Envoi') || msg.startsWith('Création')) ? '#1e40af' : '#991b1b'

  const toCorrect = history.filter(s => CORRECTABLE.includes(s.status))
  const others = history.filter(s => !CORRECTABLE.includes(s.status))
  const avecDemande = estDirect && history.filter(s => s.status === 'valide_tech')

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ---- Solde crédit ---- */}
      {estCredit && totalValide > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #1e40af', background: '#eff6ff' }}>
          <h3 style={{ marginBottom: 8, color: '#1e40af' }}>📊 Votre solde cumulatif</h3>
          <p style={{ fontSize: 14 }}>
            Montant total validé par la CAF :{' '}
            <strong style={{ fontSize: 18, color: '#1e40af' }}>{totalValide.toLocaleString('fr-FR')} FCFA</strong>
          </p>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 4 }}>
            La CAF effectuera un versement à sa convenance. Vous recevrez un email à chaque paiement.
          </p>
        </div>
      )}

      {/* ---- Demandes de paiement disponibles (directs validés) ---- */}
      {!demandeForSoum && avecDemande && (avecDemande as typeof history).length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--abed-green)', background: '#f0fdf4' }}>
          <h3 style={{ marginBottom: 8, color: '#166534' }}>💳 Timesheets prêts pour paiement</h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
            Ces timesheets sont validés techniquement. Soumettez une demande de paiement pour chacun.
          </p>
          {(avecDemande as typeof history).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: 13 }}>
                <strong>{s.titre}</strong> — {s.periode_mois}/{s.periode_annee}
                {s.heures_retenues != null && ` — ${s.heures_retenues} h retenues`}
                {s.montant_caf != null && (
                  <strong style={{ color: 'var(--abed-green)', marginLeft: 6 }}>
                    {s.montant_caf.toLocaleString('fr-FR')} FCFA
                  </strong>
                )}
              </span>
              <button className="btn" style={{ fontSize: 12, padding: '4px 14px' }}
                onClick={() => setDemandeForSoum(s)}>
                💳 Faire une demande de paiement
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---- Dossiers à corriger ---- */}
      {toCorrect.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #c0392b' }}>
          <h3 style={{ marginBottom: 12, color: '#991b1b' }}>
            Dossiers à corriger ({toCorrect.length})
          </h3>
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
                <p style={{ fontSize: 12, color: '#991b1b', marginBottom: 10, fontStyle: 'italic' }}>
                  Commentaire : {comment ?? '—'}
                </p>

                {/* Fichiers actuels */}
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
                  {s.fichier_facture_url && (
                    <button className="btn secondary" style={{ fontSize: 11 }}
                      onClick={() => openSignedFile(s.fichier_facture_url!)}>
                      🧾 Voir facture actuelle
                    </button>
                  )}
                </div>

                {/* Upload nouveaux fichiers */}
                <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 8 }}>
                  Téléversez uniquement les fichiers à remplacer (les autres restent inchangés) :
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>📊 Nouveau timesheet</label>
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'block', fontSize: 11, marginTop: 4 }}
                      onChange={e => setReFiles(r => ({ ...r, [s.id]: { ...r[s.id], ts: e.target.files?.[0] } }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>📄 Nouveau livrable</label>
                    <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'block', fontSize: 11, marginTop: 4 }}
                      onChange={e => setReFiles(r => ({ ...r, [s.id]: { ...r[s.id], liv: e.target.files?.[0] } }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>🧾 Nouvelle facture</label>
                    <input type="file" accept=".pdf" style={{ display: 'block', fontSize: 11, marginTop: 4 }}
                      onChange={e => setReFiles(r => ({ ...r, [s.id]: { ...r[s.id], fac: e.target.files?.[0] } }))} />
                  </div>
                </div>

                <button className="btn" style={{ fontSize: 12 }}
                  disabled={resubmitting === s.id}
                  onClick={() => resoumettre(s.id)}>
                  {resubmitting === s.id ? '⏳ Resoumission…' : '↩ Resoumettre pour validation'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Nouvelle soumission ---- */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Soumettre un dossier mensuel</h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
          {estDirect
            ? 'Joignez votre timesheet (obligatoire) et éventuellement un livrable. La facture sera soumise via une demande de paiement séparée.'
            : 'Joignez les trois fichiers obligatoires.'}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">📊 Timesheet Excel *</label>
            <input ref={tsRef} className="input" type="file" accept=".xlsx,.xls,.csv"
              onChange={e => setFileTS(e.target.files?.[0] ?? null)} />
            {fileTS && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileTS.name}</p>}
          </div>
          <div className="field">
            <label className="label">📄 Livrable PDF {estDirect ? '(optionnel)' : '*'}</label>
            <input ref={livRef} className="input" type="file" accept=".pdf,.doc,.docx"
              onChange={e => setFileLiv(e.target.files?.[0] ?? null)} />
            {fileLiv && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileLiv.name}</p>}
          </div>
          {!estDirect && (
            <div className="field">
              <label className="label">🧾 Facture PDF *</label>
              <input ref={facRef} className="input" type="file" accept=".pdf"
                onChange={e => setFileFac(e.target.files?.[0] ?? null)} />
              {fileFac && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileFac.name}</p>}
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

      {/* ---- Historique ---- */}
      {others.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Mes soumissions</h3>
          <div className="table-wrap">
          <table style={{ minWidth: 680 }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} /><col />
            </colgroup>
            <thead>
              <tr><th>Titre</th><th>Période</th><th>H déc.</th><th>H ret.</th><th>Montant</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {others.map(s => {
                const st = STATUS_LABEL[s.status] ?? { label: s.status, color: '#374151' }
                return (
                  <tr key={s.id}>
                    <td title={s.titre} style={{ fontWeight: 500 }}>{s.titre}</td>
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
