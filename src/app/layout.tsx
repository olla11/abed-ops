import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'ABED-ONG · Gestion des opérations',
  description: 'Ordres de mission, réconciliation et timesheets',
  icons: {
    icon: '/logoabed2.png',
    shortcut: '/logoabed2.png',
    apple: '/logoabed2.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <style>{`
          /* Masquer la barre et gadget Google Translate */
          .goog-te-banner-frame { display: none !important; }
          #goog-gt-tt, .goog-te-balloon-frame { display: none !important; }
          body { top: 0px !important; }
          /* Rendre le widget invisible mais présent dans le DOM (display:none empêche l'init) */
          #google_translate_element {
            position: absolute; width: 1px; height: 1px;
            overflow: hidden; opacity: 0; pointer-events: none;
          }
          #google_translate_element .skiptranslate { display: none !important; }
        `}</style>
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>

        {/* Google Translate widget — invisible mais actif */}
        <div id="google_translate_element" />
        <Script id="gt-init" strategy="afterInteractive">{`
          function googleTranslateElementInit() {
            new google.translate.TranslateElement(
              { pageLanguage: 'fr', includedLanguages: 'en', autoDisplay: false },
              'google_translate_element'
            );
            // Après init, appliquer la langue mémorisée dans le cookie
            if (document.cookie.indexOf('googtrans=/fr/en') !== -1) {
              applyGTLang('en');
            }
          }

          function applyGTLang(lang) {
            var sel = document.querySelector('select.goog-te-combo');
            if (!sel) { setTimeout(function(){ applyGTLang(lang); }, 200); return; }
            if (sel.value === lang) return;
            sel.value = lang;
            sel.dispatchEvent(new Event('change'));
          }

          window.__gtApplyLang = applyGTLang;
        `}</Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
