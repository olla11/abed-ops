'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Award, X, Smartphone, HandCoins, Upload, BadgeCheck, Sparkles, Plane, Wallet, Trophy, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { NOM_CLUB, MOMO_PAY_ABED } from '@/lib/dons'

// Jour (local) où ce navigateur a déjà eu sa réponse — évite de redemander
// au serveur à chaque page. La règle « une fois par jour » elle-même est
// tenue côté serveur (/api/annonces/heritage), commune à tous les onglets.
const CLE_TRAITEE = 'abed_annonce_heritage_traitee_le'
const aujourdhui = () => new Date().toDateString()

// Pas sur les pages publiques ni sur les pages qui présentent déjà ABED
// Héritage elles-mêmes.
const CHEMINS_EXCLUS = [
  '/login', '/auth/', '/conditions-utilisation', '/politique-confidentialite', '/signatures/externe',
  '/contrats/externe', '/presence/', '/verify/', '/om/externe', '/dons', '/abed-heritage',
]

type Ligne = { Icon: LucideIcon; titre: string; texte: string }

function Lignes({ lignes, numerotees = false }: { lignes: Ligne[]; numerotees?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {lignes.map((l, i) => (
        <div key={l.titre} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#f7fdf9', border: '1px solid #d1fae5', borderRadius: 12, padding: '12px 14px' }}>
          <span style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#065f46', color: 'white', fontWeight: 800, fontSize: 15,
          }}>
            {numerotees ? i + 1 : <l.Icon size={19} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{l.titre}</div>
            <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.55, marginTop: 2 }}>{l.texte}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const ECRANS: { surtitre: string; titre: string; contenu: React.ReactNode }[] = [
  {
    surtitre: 'Nouveau sur My ABED',
    titre: NOM_CLUB,
    contenu: (
      <div style={{ textAlign: 'center', padding: '6px 4px' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto 16px', background: 'linear-gradient(160deg, #fef3c7, #fcd34d)', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={42} color="#92400e" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#065f46', margin: '0 0 10px' }}>Ce que nous construisons ensemble nous survit.</p>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, margin: '0 auto', maxWidth: 480 }}>
          {`${NOM_CLUB} est le cercle de celles et ceux qui donnent à ABED pour faire durer son action. Chaque don, même modeste, vous en fait membre, et chaque année les plus engagés sont distingués au tableau d'honneur.`}
        </p>
      </div>
    ),
  },
  {
    surtitre: 'Comment donner',
    titre: 'Trois étapes, une minute',
    contenu: (
      <Lignes numerotees lignes={[
        { Icon: HandCoins, titre: 'Choisissez votre montant', texte: 'Dans Mon espace → ABED Héritage, du montant de votre choix.' },
        { Icon: Smartphone, titre: 'Payez par MoMo', texte: `Composez *880*41*${MOMO_PAY_ABED}*MONTANT# (MoMo Pay ABED : ${MOMO_PAY_ABED}). Le code se remplit tout seul avec votre montant.` },
        { Icon: Upload, titre: 'Joignez la capture', texte: 'Ajoutez la capture du message de confirmation et soumettez. L\'AAF vérifie, et votre don est compté.' },
      ]} />
    ),
  },
  {
    surtitre: 'Quand donner',
    titre: 'Trois façons de donner',
    contenu: (
      <Lignes lignes={[
        { Icon: Sparkles, titre: 'À tout moment', texte: 'Un don spontané depuis Mon espace → ABED Héritage, quand vous le souhaitez.' },
        { Icon: Plane, titre: 'Mission financée par un partenaire', texte: 'Le prélèvement de 20 % est supprimé. À la réconciliation, vous pouvez donner le pourcentage de votre choix du montant reçu.' },
        { Icon: Wallet, titre: 'Mission à crédit', texte: 'À la réconciliation, vous pouvez renoncer à tout ou partie du remboursement que ABED vous doit, sans rien verser.' },
      ]} />
    ),
  },
  {
    surtitre: 'Votre engagement reconnu',
    titre: 'Rejoignez le tableau d\'honneur',
    contenu: (
      <Lignes lignes={[
        { Icon: BadgeCheck, titre: `La pastille ${NOM_CLUB}`, texte: 'Dès votre premier don confirmé, elle s\'affiche à côté de votre nom sur votre page d\'accueil.' },
        { Icon: Trophy, titre: 'Or, Argent, Bronze', texte: 'Chaque année, les trois plus grands donateurs sont distingués, et tous les membres figurent au tableau d\'honneur.' },
        { Icon: Award, titre: 'Discret', texte: 'Les montants ne sont jamais affichés : seul votre engagement l\'est.' },
      ]} />
    ),
  },
]

export default function AnnonceHeritage() {
  const pathname = usePathname()
  const exclu = CHEMINS_EXCLUS.some(p => pathname?.startsWith(p))
  const [ouverte, setOuverte] = useState(false)
  const [ecran, setEcran] = useState(0)
  // Fermeture possible seulement une fois les 4 écrans parcourus.
  const [vuJusqua, setVuJusqua] = useState(0)
  const toutVu = vuJusqua >= ECRANS.length - 1

  useEffect(() => { setVuJusqua(v => Math.max(v, ecran)) }, [ecran])

  async function verifier() {
    try {
      if (localStorage.getItem(CLE_TRAITEE) === aujourdhui()) return
    } catch { /* stockage indisponible : le serveur décide seul */ }
    try {
      // Les fenêtres bloquantes (CGU, profil à compléter) passent d'abord —
      // ne jamais empiler celle-ci par-dessus.
      const [legal, profil] = await Promise.all([
        fetch('/api/legal/statut').then(r => r.json()).catch(() => ({})),
        fetch('/api/profile/completion-statut').then(r => r.json()).catch(() => ({})),
      ])
      if (legal.needsAcceptance || profil.needsCompletion) return
      const res = await fetch('/api/annonces/heritage')
      const d = await res.json()
      try { localStorage.setItem(CLE_TRAITEE, aujourdhui()) } catch { /* ignore */ }
      if (d.afficher) { setEcran(0); setVuJusqua(0); setOuverte(true) }
    } catch { /* réseau : on réessaiera à la prochaine navigation */ }
  }

  useEffect(() => {
    if (exclu) return
    verifier()
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      // Changement de compte sur ce navigateur : l'autre personne a droit
      // à sa propre réponse du serveur.
      if (event === 'SIGNED_IN') {
        try { localStorage.removeItem(CLE_TRAITEE) } catch { /* ignore */ }
        verifier()
      }
      if (event === 'SIGNED_OUT') setOuverte(false)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exclu, pathname])

  useEffect(() => {
    if (!ouverte) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fermer()
      if (e.key === 'ArrowRight') setEcran(i => Math.min(ECRANS.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setEcran(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, toutVu])

  function fermer() {
    if (!toutVu) return
    setOuverte(false)
  }

  if (exclu || !ouverte) return null
  const e = ECRANS[ecran]
  const dernier = ecran === ECRANS.length - 1

  return (
    <div role="dialog" aria-modal="true" aria-label={`Nouveau : ${NOM_CLUB}`} onClick={fermer} style={{
      position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(6,30,24,.62)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={ev => ev.stopPropagation()} style={{
        background: 'white', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.35)',
      }}>
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 55%, #047857 100%)', color: 'white', padding: '22px 26px 20px', position: 'relative' }}>
          {toutVu && (
            <button onClick={fermer} aria-label="Fermer" style={{
              position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,.15)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={18} />
            </button>
          )}
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#fcd34d' }}>{e.surtitre}</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, paddingRight: 40 }}>{e.titre}</div>
        </div>

        <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1, minHeight: 300 }}>{e.contenu}</div>

        <div style={{ padding: '14px 26px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {ECRANS.map((_, i) => (
              <button key={i} onClick={() => setEcran(i)} disabled={i > vuJusqua} aria-label={`Écran ${i + 1}`} style={{
                width: i === ecran ? 22 : 8, height: 8, borderRadius: 8, border: 'none', padding: 0,
                cursor: i > vuJusqua ? 'default' : 'pointer',
                background: i === ecran ? '#065f46' : i <= vuJusqua ? '#86efac' : '#d1d5db', transition: 'width .2s',
              }} />
            ))}
            <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 6 }}>{`${ecran + 1} / ${ECRANS.length}`}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {ecran > 0 && (
              <button className="btn secondary" onClick={() => setEcran(i => i - 1)} style={{ fontSize: 13 }}>
                <ChevronLeft size={15} /> Précédent
              </button>
            )}
            {dernier ? (
              <>
                <Link href="/abed-heritage" className="btn secondary" onClick={fermer} style={{ fontSize: 13, textDecoration: 'none' }}>
                  Tableau d&apos;honneur
                </Link>
                <Link href="/dons" className="btn" onClick={fermer} style={{ fontSize: 13, textDecoration: 'none', background: '#d97706' }}>
                  <HandCoins size={15} /> Faire un don
                </Link>
              </>
            ) : (
              <>
                {toutVu && <button className="btn secondary" onClick={fermer} style={{ fontSize: 13 }}>Plus tard</button>}
                <button className="btn" onClick={() => setEcran(i => i + 1)} style={{ fontSize: 13 }}>
                  Suivant <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
