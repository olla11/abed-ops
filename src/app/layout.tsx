import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Script from 'next/script'
import { GoogleTranslateReapply } from '@/components/GoogleTranslate'
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
          .goog-te-banner-frame, .goog-te-balloon-frame { display: none !important; }
          #goog-gt-tt { display: none !important; }
          body { top: 0px !important; }
          #google_translate_element {
            position: fixed; bottom: -100px; left: 0;
            width: 1px; height: 1px; overflow: hidden; opacity: 0.01;
          }
        `}</style>
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <GoogleTranslateReapply />
        </NextIntlClientProvider>

        {/* GT widget hors du flux, opacity 0.01 pour éviter display:none qui bloque l'init */}
        <div id="google_translate_element" />

        <Script id="gt-init" strategy="afterInteractive">{`
          function GTranslateFireEvent(el, ev) {
            try {
              var e = document.createEvent('HTMLEvents');
              e.initEvent(ev, true, true);
              el.dispatchEvent(e);
            } catch(e) {}
          }

          function doGTranslate(lang) {
            var sels = document.getElementsByTagName('select');
            var combo = null;
            for (var i = 0; i < sels.length; i++) {
              if (sels[i].className.indexOf('goog-te-combo') >= 0) { combo = sels[i]; break; }
            }
            var el = document.getElementById('google_translate_element');
            if (!el || !el.innerHTML || !combo) {
              setTimeout(function(){ doGTranslate(lang); }, 300);
              return;
            }
            combo.value = lang;
            GTranslateFireEvent(combo, 'change');
            setTimeout(function(){ GTranslateFireEvent(combo, 'change'); }, 150);
          }

          window.doGTranslate = doGTranslate;

          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement(
              { pageLanguage: 'fr', includedLanguages: 'en', autoDisplay: false },
              'google_translate_element'
            );
            if (document.cookie.indexOf('googtrans=/fr/en') >= 0) {
              setTimeout(function(){ doGTranslate('en'); }, 500);
            }
          };
        `}</Script>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
