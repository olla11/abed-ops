import Link from 'next/link'
import { LOGO_COLOR_PNG_B64 } from '@/lib/logo-color-b64'

// Habillage partagé par les pages légales publiques (CGU, politique de
// confidentialité) — accessibles sans compte, donc pas d'AppHeader. Logo en
// base64 (déjà utilisé pour l'entête des PDF) pour un rendu garanti sans
// dépendre d'un fichier statique.
export default function LegalPageLayout({
  title, updatedAt, children, otherHref, otherLabel,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
  otherHref: string
  otherLabel: string
}) {
  return (
    // marginTop négatif : globals.css réserve 60px en haut de <body> pour
    // l'AppHeader des pages authentifiées, absent ici.
    <div style={{ minHeight: '100vh', marginTop: -60, background: '#f4f6f4', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src={`data:image/png;base64,${LOGO_COLOR_PNG_B64}`} alt="ABED" width={44} height={44} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1f7a1f', textTransform: 'uppercase', letterSpacing: '.4px' }}>My ABED</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>ABED-ONG · Parakou, Bénin</div>
          </div>
          <Link href="/login" style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 600 }}>
            ← Retour à la connexion
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 10px 32px rgba(0,0,0,.06)', padding: '36px 32px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-.3px' }}>{title}</h1>
          <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 30px', fontWeight: 600 }}>Dernière mise à jour : {updatedAt}</p>

          <div style={{ fontSize: 14.5, lineHeight: 1.75, color: '#374151' }}>
            {children}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20 }}>
          Voir aussi : <Link href={otherHref} style={{ color: '#1f7a1f', fontWeight: 700, textDecoration: 'none' }}>{otherLabel}</Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 22 }}>ABED-ONG · Parakou, Quartier Zongo, Bénin · contact@abedong.org</p>
      </div>
    </div>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 30, scrollMarginTop: 20 }}>
      <h2 style={{ fontSize: 16.5, fontWeight: 800, color: '#166534', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1.5px solid #e5e7eb' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

// Sous-section numérotée (1.1, 1.2...) à l'intérieur d'une Section — pour les
// sujets qui comptent plusieurs points distincts plutôt qu'une simple liste.
export function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 16, scrollMarginTop: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>{title}</h3>
      {children}
    </div>
  )
}

// Les labels du sommaire portent déjà leur numéro ("1. Objet...", "1.1
// Définition...") — une liste à puces simple évite la double numérotation
// qu'un <ol> ajouterait par-dessus.
export function Toc({ items }: { items: { id: string; label: string; sub?: boolean }[] }) {
  return (
    <nav style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', marginBottom: 32 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Sommaire</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13.5, lineHeight: 1.9 }}>
        {items.map(it => (
          <li key={it.id} style={{ paddingLeft: it.sub ? 18 : 0 }}>
            <a href={`#${it.id}`} style={{ color: it.sub ? '#4b5563' : '#1f7a1f', fontWeight: it.sub ? 400 : 700, textDecoration: 'none', fontSize: it.sub ? 12.5 : 13.5 }}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
