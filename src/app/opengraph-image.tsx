import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori can't read CSS variables, so these repeat the Thermal tokens from globals.css.
const night = "#0b0a10";
const mist = "#f3f0ff";
const hush = "#a9a3c2";
const heat = ["#2a0b4f", "#7a1e6e", "#d2433e", "#f7902b", "#fce78a"];

// site.tagline in three lines that fit at 70 px, with Bittensor burning orange.
const lead = "Chat with AI on";
const hot = "Bittensor";
const tail = "GPUs people lend.";
const subtitle = "Sealed hardware on subnet 64. Paid in USDG on Robinhood Chain.";
const powered = "Powered by Bittensor";

// The LogoMark artwork (250 x 258), read once at build. Satori takes images as data URLs.
const logo = `data:image/png;base64,${await readFile(join(process.cwd(), "src/components/brand/logo.png"), "base64")}`;

/** Anybody, instanced extra wide and black (headline) and normal medium (subtitle), subset to the glyphs drawn here. */
async function anybody() {
  const text = encodeURIComponent(site.wordmark + lead + hot + tail + subtitle + powered + "and");
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@100,500;150,900&text=${text}`).then((r) =>
    r.text(),
  );
  const faces = [...css.matchAll(/font-weight: (\d+);[^}]*?src: url\((.+?)\) format\('(?:truetype|opentype)'\)/g)];
  return Promise.all(
    faces.map(async ([, weight, url]) => ({
      name: "Anybody",
      weight: Number(weight) as 500 | 900,
      data: await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)))),
    })),
  );
}

export default async function Image() {
  // Offline builds fall back to the bundled default font rather than failing.
  const fonts = await anybody().catch(() => []);
  const headline = { fontSize: 70, fontWeight: 900, lineHeight: 0.98, letterSpacing: "-0.02em" };
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px 84px",
          background: night,
          color: mist,
          fontFamily: "Anybody",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img src={logo} width={109} height={112} alt="" />
            <span style={{ fontSize: 60, fontWeight: 900, letterSpacing: "-0.02em" }}>{site.wordmark}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 26px",
              borderRadius: 999,
              border: `2px solid ${heat[1]}`,
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            {/* The τ from src/components/brand/Tau.tsx. */}
            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={heat[3]} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5Q4.5 6 7.5 6H20.5" />
              <path d="M12.5 6V16Q12.5 19.5 16 19.5H17.5" />
            </svg>
            {powered}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={headline}>{lead}</span>
          <div style={{ ...headline, display: "flex", gap: "0.3em" }}>
            <span style={{ color: heat[3] }}>{hot}</span>
            <span>and</span>
          </div>
          <span style={headline}>{tail}</span>
          <span style={{ marginTop: 30, fontSize: 30, fontWeight: 500, color: hush }}>{subtitle}</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 14,
            display: "flex",
            background: `linear-gradient(90deg, ${heat.join(", ")})`,
          }}
        />
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
