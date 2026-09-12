'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const CHEMINS_EXCLUS = ['/conditions-utilisation', '/politique-confidentialite', '/login', '/auth/']

type Missing = {
  dateEmbauche: boolean
  biographie: boolean
  consentement: boolean
  photo: boolean
  pieceIdentite: boolean
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }

// Le formulaire d'inscription a reçu de nouveaux champs après coup — les
// comptes créés avant cette évolution ne les ont jamais renseignés. Cette
// fenêtre (même mécanisme bloquant que LegalConsentGate, montée juste après
// elle dans le layout racine) les invite à compléter leur profil, sauf le
// superadmin qui n'est pas suivi comme un membre du personnel.
export default function ProfileCompletionGate() {
  const pathname = usePathname()
  const exclu = CHEMINS_EXCLUS.some(p => pathname?.startsWith(p))

  const [checked, setChecked] = useState(false)
  const [missing, setMissing] = useState<Missing | null>(null)
  const [impersonating, setImpersonating] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [dateEmbauche, setDateEmbauche] = useState('')
  const [biographie, setBiographie] = useState('')
  const [consentement, setConsentement] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [pieceIdentite, setPieceIdentite] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const etaitEnUsurpation = useRef(false)

  async function verifierStatut() {
    try {
      // La fenêtre CGU (montée juste avant celle-ci) doit être traitée en
      // premier — si elle est encore due, on attend plutôt que d'empiler
      // deux fenêtres bloquantes à l'écran en même temps.
      const legal = await fetch('/api/legal/statut').then(r => r.json()).catch(() => ({ needsAcceptance: false }))
      if (legal.needsAcceptance) { setChecked(true); setMissing(null); return }

      const res = await fetch('/api/profile/completion-statut')
      const d = await res.json()
      setMissing(d.needsCompletion ? d.missing : null)
      const enUsurpation = !!d.impersonating
      // Un "décliner" ne doit valoir que pour LA session d'usurpation en
      // cours — repéré via une ref (pas du state, pour éviter la
      // dépendance de closure) plutôt qu'au pathname, qui change à chaque
      // navigation sans que l'usurpation change.
      if (enUsurpation && !etaitEnUsurpation.current) setDismissed(false)
      etaitEnUsurpation.current = enUsurpation
      setImpersonating(enUsurpation)
    } catch {
      // Erreur réseau ponctuelle : pas de blocage, re-vérifié à la prochaine navigation.
    } finally {
      setChecked(true)
    }
  }

  useEffect(() => {
    if (exclu) return
    verifierStatut()
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') verifierStatut()
      if (event === 'SIGNED_OUT') setMissing(null)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exclu, pathname])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > 10 * 1024 * 1024) { setErr('Fichier trop volumineux (max. 10 MB).'); e.target.value = ''; setter(null); return }
    setter(f)
  }

  async function seDeconnecter() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (exclu || !checked || !missing || dismissed) return null

  const pret =
    (!missing.dateEmbauche || !!dateEmbauche) &&
    (!missing.biographie || biographie.trim().length > 0) &&
    (!missing.consentement || !!consentement) &&
    (!missing.photo || !!photo) &&
    (!missing.pieceIdentite || !!pieceIdentite)

  async function soumettre() {
    if (!pret) return
    setSubmitting(true); setErr('')
    try {
      const body = new FormData()
      if (missing!.dateEmbauche) body.append('date_embauche', dateEmbauche)
      if (missing!.biographie) body.append('biographie', biographie)
      if (missing!.consentement) body.append('consentement_communication', consentement)
      if (missing!.photo && photo) body.append('photo', photo)
      if (missing!.pieceIdentite && pieceIdentite) body.append('piece_identite', pieceIdentite)
      const res = await fetch('/api/profile/completer', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erreur — réessayez.'); return }
      await verifierStatut()
    } catch {
      setErr('Erreur réseau — réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(17,24,39,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.35)', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 28px 0', flexShrink: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            Complétez votre profil
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
            My ABED a besoin de quelques informations supplémentaires sur vous pour compléter votre dossier
            personnel. Merci de les renseigner pour continuer.
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {missing.dateEmbauche && (
            <div>
              <label style={lbl}>Date de prise de service *</label>
              <input style={inp} type="date" value={dateEmbauche} onChange={e => setDateEmbauche(e.target.value)} />
            </div>
          )}
          {missing.biographie && (
            <div>
              <label style={lbl}>Courte biographie (3 à 5 lignes) *</label>
              <textarea style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} rows={4} value={biographie} onChange={e => setBiographie(e.target.value)} />
            </div>
          )}
          {missing.photo && (
            <div>
              <label style={lbl}>Photo professionnelle *</label>
              <input style={inp} type="file" accept="image/*" onChange={e => pickFile(e, setPhoto)} />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>1 fichier, max. 10 MB.</p>
            </div>
          )}
          {missing.pieceIdentite && (
            <div>
              <label style={lbl}>Pièce d&apos;identité en cours de validité *</label>
              <input style={inp} type="file" accept="image/*,application/pdf" onChange={e => pickFile(e, setPieceIdentite)} />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>1 fichier, max. 10 MB.</p>
            </div>
          )}
          {missing.consentement && (
            <div>
              <label style={lbl}>
                Autorisez-vous l&apos;utilisation de vos informations et de votre photo pour la communication interne et externe ? *
              </label>
              <div style={{ display: 'flex', gap: 16 }}>
                {['Oui', 'Non'].map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="radio" name="consentement_communication" value={v} checked={consentement === v}
                      onChange={e => setConsentement(e.target.value)} />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          )}
          {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={seDeconnecter} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
              Se déconnecter
            </button>
            {impersonating && (
              <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
                Ignorer (test admin)
              </button>
            )}
            <button
              onClick={soumettre}
              disabled={!pret || submitting}
              style={{
                marginLeft: 'auto', padding: '12px 28px', borderRadius: 999, fontSize: 14, fontWeight: 800,
                background: pret ? 'linear-gradient(135deg, #1f7a1f, #16a34a)' : '#d1d5db',
                color: 'white', border: 'none', cursor: pret ? 'pointer' : 'default',
                opacity: submitting ? .7 : 1,
              }}
            >
              {submitting ? 'Enregistrement...' : 'Valider mon profil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
