import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SessionProvider } from "./session-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import Script from "next/script";
import { JsonLd } from "@/components/seo/JsonLd";
import MetaPixel from "@/components/MetaPixel";
import { AISearchReferrerTracker } from "@/components/analytics/AISearchReferrerTracker";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.unlistedstox.com"),
  title: {
    default: "SMC Unlisted Stocks — Invest in Pre-IPO & Unlisted Shares",
    template: "%s | UnlistedStox",
  },
  description:
    "Discover curated pre-IPO investment opportunities. Buy unlisted shares from high-growth companies with secure off-market transfers, backed by SMC Group.",
  manifest: "/manifest.json",
  applicationName: "Unlisted Stox",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/icons/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icons/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icons/favicon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icons/favicon-dark-16x16.png",
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon.ico",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: false,
    statusBarStyle: "default",
    title: "Unlisted Stox",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "UnlistedStox",
    title: "SMC Unlisted Stocks — Invest in Pre-IPO & Unlisted Shares",
    description:
      "Discover curated pre-IPO investment opportunities. Buy unlisted shares from high-growth companies, backed by SMC Group.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SMC Unlisted Stocks — Invest in Pre-IPO & Unlisted Shares",
    description:
      "Discover curated pre-IPO investment opportunities. Buy unlisted shares from high-growth companies, backed by SMC Group.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = (process.env.NEXT_PUBLIC_GTM_ID || process.env.GTM_ID || "").trim();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Outfit:wght@100..900&display=swap"
          rel="stylesheet"
        />
        {/* Banner grabbing prevention: strip Next.js version from window globals */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var _n=undefined;Object.defineProperty(window,'next',{configurable:true,enumerable:true,get:function(){return _n;},set:function(v){if(v&&typeof v==='object'){try{delete v.version;Object.defineProperty(v,'version',{configurable:true,enumerable:false,get:function(){return undefined;},set:function(){}});}catch(e){}} _n=v;}});var _d=undefined;Object.defineProperty(window,'__NEXT_DATA__',{configurable:true,enumerable:true,get:function(){return _d;},set:function(v){if(v&&typeof v==='object'){try{delete v.version;Object.defineProperty(v,'version',{configurable:true,enumerable:false,get:function(){return undefined;},set:function(){}});}catch(e){}} _d=v;}});}catch(e){}})();`,
          }}
        />
        {/* Suppress native mobile browser PWA "Install Application" prompt / mini-infobar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window!=='undefined'){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();return false;});}})();`,
          }}
        />
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        {/* ── Google Tag Manager ── */}
        {gtmId && (
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        )}
        {/* ── Meta Pixel ── */}
        <MetaPixel />
        {/* ── JSON-LD: Organization ── */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "UnlistedStox",
            url: "https://www.unlistedstox.com",
            logo: "https://www.unlistedstox.com/icons/apple-touch-icon.png",
            description:
              "Buy curated pre-IPO & unlisted shares from high-growth companies with secure off-market transfers, backed by SMC Group.",
            sameAs: [],
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "support@unlistedstox.com",
            },
          }}
        />
        {/* ── JSON-LD: WebSite + SearchAction ── */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "UnlistedStox",
            url: "https://www.unlistedstox.com",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate:
                  "https://www.unlistedstox.com/stocks?q={search_term_string}",
              },
              "query-input": "required name=search_term_string",
            },
          }}
        />

        {/* ── Google Tag Manager (noscript fallback) ── */}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <SessionProvider>
          <Providers>
            {children}
            <ServiceWorkerRegister />
          </Providers>
        </SessionProvider>
        <AISearchReferrerTracker />
        <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="lazyOnload" />
        <Script src="https://sdk.digitap.ai/e-sign/scripts/digitap_esign.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
