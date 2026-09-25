import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
import { TAU_PATHS } from "@/components/brand/Tau";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori can't read CSS variables, so these repeat the Thermal tokens from globals.css.
const night = "#0b0a10";
const mist = "#f3f0ff";
const hush = "#a9a3c2";
const heat = ["#2a0b4f", "#7a1e6e", "#d2433e", "#f7902b", "#fce78a"];

// site.tagline in three lines, with Bittensor burning orange.
const lead = "Private compute,";
const mid = "powered by";
const hot = "Bittensor.";
const subtitle = "Open models, GPU mining, sealed messages. Paid on Robinhood Chain.";
const powered = "Powered by Bittensor";

/** The LogoMark from src/components/brand/Logo.tsx in hex: the τ glowing on a sealed chip die. */
function Mark({ px }: { px: number }) {
  const tau = TAU_PATHS.map((d) => <path key={d} d={d} />);
  return (
    <svg width={px} height={px} viewBox="0 0 32 32">
      <defs>
        <radialGradient id="heat">
          <stop offset="0" stopColor={heat[1]} stopOpacity="0.6" />
          <stop offset="0.7" stopColor={heat[1]} stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="5" fill={night} />
      <rect x="1" y="1" width="30" height="30" rx="5" fill="url(#heat)" />
      <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="4.4" fill="none" stroke={heat[2]} strokeOpacity="0.75" strokeWidth="1.2" strokeDasharray="2.3 1.687" />
      <g transform="translate(16 16) scale(1.05) translate(-12 -12.75)" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <g stroke={heat[2]} opacity="0.85" filter="url(#glow)">{tau}</g>
        <g stroke={heat[3]}>{tau}</g>
      </g>
    </svg>
  );
}

/** Anybody, instanced extra wide and black (headline) and normal medium (subtitle), subset to the glyphs drawn here. */
async function anybody() {
  const text = encodeURIComponent(site.wordmark + lead + mid + hot + subtitle + powered);
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
            <Mark px={112} />
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
              {TAU_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            {powered}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={headline}>{lead}</span>
          <span style={headline}>{mid}</span>
          <span style={{ ...headline, color: heat[3] }}>{hot}</span>
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
