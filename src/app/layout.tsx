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
          /* Masquer la barre Google Translate */
          .goog-te-banner-frame, .goog-te-gadget, #goog-gt-tt,
          .goog-te-balloon-frame, .goog-tooltip { display: none !important; }
          body { top: 0px !important; }
          .skiptranslate { display: none !important; }
        `}</style>
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>

        {/* Google Translate — élément caché, piloté par LanguageSwitcher */}
        <div id="google_translate_element" style={{ display: 'none' }} />
        <Script id="gt-init" strategy="afterInteractive">{`
          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement(
              { pageLanguage: 'fr', includedLanguages: 'en' },
              'google_translate_element'
            );
          };

          // Applique la langue dès que le widget GT est prêt
          window.__abedApplyLang = function(targetLang) {
            var sel = document.querySelector('.goog-te-combo');
            if (!sel) { setTimeout(function(){ window.__abedApplyLang(targetLang); }, 300); return; }
            sel.value = targetLang;
            sel.dispatchEvent(new Event('change'));
          };

          // Si le cookie indique EN, appliquer après init
          if (document.cookie.indexOf('googtrans=/fr/en') !== -1) {
            window.addEventListener('load', function() {
              setTimeout(function(){ window.__abedApplyLang('en'); }, 800);
            });
          }
        `}</Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
