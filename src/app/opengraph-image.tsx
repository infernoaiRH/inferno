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

// site.tagline, split so its end can burn orange.
const lead = "Chat with AI that runs on";
const hot = "GPUs people lend.";
const subtitle = "AI inference on Robinhood Chain. Lenders get paid in USDG.";

/** Anybody, instanced extra wide and black (headline) and normal medium (subtitle), subset to the glyphs drawn here. */
async function anybody() {
  const text = encodeURIComponent(site.wordmark + lead + hot + subtitle);
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

/** The LogoMark from src/components/brand/Logo.tsx: a violet dragon breathing fire along the heat ramp. */
function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="body" x1="3" y1="31" x2="16" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={heat[0]} />
          <stop offset="0.5" stopColor={heat[1]} />
          <stop offset="1" stopColor={heat[2]} />
        </linearGradient>
        <linearGradient id="fire" x1="18" y1="20" x2="31.5" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={heat[2]} />
          <stop offset="0.45" stopColor={heat[3]} />
          <stop offset="1" stopColor={heat[4]} />
        </linearGradient>
      </defs>
      <path
        d="M18.6 19.3 C21.8 17.9 25 16.2 28.6 13.6 Q27.3 16.3 31 16.6 Q28.2 18.5 31.6 20.6 Q28.1 21.4 29.8 24.8 C26.2 22.6 22.4 20.7 18.6 19.3 Z"
        fill="url(#fire)"
      />
      <path
        d="M2.6 31 L3.3 26.1 L1.1 24.4 L4.2 23.3 L2.5 20.3 L5.3 19.7 L3.9 16.2 L6.7 16.3 L2.1 7 L9.7 12.5 L12.5 11.7 L15.6 12.3 L17.4 10.9 L18.3 12.9 L24.7 14.3 L26.5 15.7 L25.3 16.9 L22.8 17 L22.2 18.3 L21.6 17.1 L17.3 17.9 L23.7 20.3 L22.4 21.7 L16.8 22.6 L12.8 23.4 L10.9 26.2 L10.3 31 Z"
        fill="url(#body)"
        stroke={heat[1]}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d="M14.4 15 Q15.9 13.7 17.4 14.2 Q16 15.4 14.4 15 Z" fill={heat[4]} />
    </svg>
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
        <div style={{ position: "absolute", right: -70, bottom: -30, display: "flex", opacity: 0.18 }}>
          <Mark px={540} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark px={60} />
          <span style={{ fontSize: 46, fontWeight: 900, letterSpacing: "-0.02em" }}>{site.wordmark}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={headline}>{lead}</span>
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
