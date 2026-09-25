import type { Metadata, Viewport } from "next";
import { Anybody, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { CommandPalette } from "@/components/palette/CommandPalette";

// Anybody carries the personality: loud, and its width axis (50 to 150) lets headlines expand as things heat up.
const anybody = Anybody({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["wdth"],
  variable: "--font-anybody",
  display: "swap",
});

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: private compute on Bittensor, paid on Robinhood Chain`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { title: site.name, description: site.description, siteName: site.name, type: "website" },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
};

export const viewport: Viewport = { themeColor: "#0b0a10", colorScheme: "dark" };

// Tells search engines and AI assistants who runs this site and where its official X account is.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#org`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.png`,
      description: site.description,
      sameAs: [site.x],
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      name: site.name,
      url: site.url,
      description: site.tagline,
      publisher: { "@id": `${site.url}/#org` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anybody.variable} ${hanken.variable}`}>
      <body className="min-h-dvh">
        <script
          type="application/ld+json"
          // Escaped so no string in it can close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-moon focus:px-4 focus:py-2 focus:text-night"
        >
          Skip to content
        </a>
        <WalletProvider>
          {children}
          <CommandPalette />
        </WalletProvider>
      </body>
    </html>
  );
}
