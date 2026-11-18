import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import SplashScreen from "@/components/SplashScreen";

const plusJakartaSans = localFont({
  src: "./fonts/plus-jakarta-sans-v12-latin-regular.woff2",
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SMC Unlisted Stocks - Invest in Unlisted Shares",
  description:
    "Trade unlisted stocks with SMC. Explore exclusive investment opportunities in pre-IPO companies.",
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Banner grabbing prevention: strip Next.js version from window globals */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var _n=undefined;Object.defineProperty(window,'next',{configurable:true,enumerable:true,get:function(){return _n;},set:function(v){if(v&&typeof v==='object'){try{delete v.version;Object.defineProperty(v,'version',{configurable:true,enumerable:false,get:function(){return undefined;},set:function(){}});}catch(e){}} _n=v;}});var _d=undefined;Object.defineProperty(window,'__NEXT_DATA__',{configurable:true,enumerable:true,get:function(){return _d;},set:function(v){if(v&&typeof v==='object'){try{delete v.version;Object.defineProperty(v,'version',{configurable:true,enumerable:false,get:function(){return undefined;},set:function(){}});}catch(e){}} _d=v;}});}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} font-sans`}
        suppressHydrationWarning
      >
        <Providers>
          <SplashScreen />
          {children}
        </Providers>
      </body>
    </html>
  );
}

